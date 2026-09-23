use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use super::error::VaultError;

pub type Result<T> = std::result::Result<T, VaultError>;

const NOTE_EXT: &str = "md";
const ICLOUD_PLACEHOLDER_EXT: &str = ".icloud";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Dir,
    Note,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// 保管庫からの相対パス。区切りは常に `/`
    pub path: String,
    pub kind: EntryKind,
    /// 中身がまだ端末に無い iCloud のファイル（`.名前.md.icloud`）
    pub placeholder: bool,
    /// `<名前> <数字>.md` と `<名前>.md` が並んでいる。iCloud の衝突の疑い
    pub conflict: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontMatter {
    pub path: String,
    /// 開きと閉じの `---` の間の行
    pub text: String,
}

/// 閉じの `---` を探す行数の上限。`src/lib/front-matter.ts` と同じ値にする
const FRONT_MATTER_MAX_LINES: usize = 1000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub content: String,
    pub hash: String,
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

/// 保管庫からの相対パスを検査して、絶対パスにする。
/// `..` や絶対パス、`.` で始まる要素（隠しファイル）を含むものは拒む。
pub fn resolve(root: &Path, rel: &str) -> Result<PathBuf> {
    let rel_path = Path::new(rel);
    if rel.is_empty() || rel_path.is_absolute() {
        return Err(VaultError::OutsideVault(rel.to_owned()));
    }
    let mut out = root.to_path_buf();
    for component in rel_path.components() {
        match component {
            Component::Normal(part) => {
                let part_str = part.to_string_lossy();
                if part_str.starts_with('.') {
                    return Err(VaultError::InvalidPath(rel.to_owned()));
                }
                out.push(part);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(VaultError::OutsideVault(rel.to_owned()));
            }
        }
    }
    // シンボリックリンクで外へ出ていないかを、実在する一番深い祖先で確かめる
    let canonical_root = root.canonicalize()?;
    let mut existing = out.as_path();
    while !existing.exists() {
        match existing.parent() {
            Some(parent) => existing = parent,
            None => break,
        }
    }
    if existing.exists() && !existing.canonicalize()?.starts_with(&canonical_root) {
        return Err(VaultError::OutsideVault(rel.to_owned()));
    }
    Ok(out)
}

fn resolve_note(root: &Path, rel: &str) -> Result<PathBuf> {
    let path = resolve(root, rel)?;
    if path.extension().and_then(|e| e.to_str()) != Some(NOTE_EXT) {
        return Err(VaultError::InvalidPath(rel.to_owned()));
    }
    Ok(path)
}

fn to_rel(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    Some(parts.join("/"))
}

/// `.名前.md.icloud` なら `名前.md` を返す
fn placeholder_target(name: &str) -> Option<&str> {
    let inner = name
        .strip_prefix('.')?
        .strip_suffix(ICLOUD_PLACEHOLDER_EXT)?;
    inner.ends_with(".md").then_some(inner)
}

/// `メモ 2.md` なら `メモ.md` を返す
fn conflict_base(name: &str) -> Option<String> {
    let stem = name.strip_suffix(".md")?;
    let (base, num) = stem.rsplit_once(' ')?;
    if base.is_empty() || num.is_empty() || !num.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(format!("{base}.md"))
}

pub fn list(root: &Path) -> Result<Vec<Entry>> {
    let mut out = Vec::new();
    list_dir(root, root, &mut out)?;
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn list_dir(root: &Path, dir: &Path, out: &mut Vec<Entry>) -> Result<()> {
    let mut notes: Vec<(String, bool)> = Vec::new();
    for item in fs::read_dir(dir)? {
        let item = item?;
        let name = item.file_name().to_string_lossy().into_owned();
        let file_type = item.file_type()?;
        if let Some(target) = placeholder_target(&name) {
            notes.push((target.to_owned(), true));
            continue;
        }
        if name.starts_with('.') {
            continue;
        }
        if file_type.is_dir() {
            if let Some(rel) = to_rel(root, &item.path()) {
                out.push(Entry {
                    path: rel,
                    kind: EntryKind::Dir,
                    placeholder: false,
                    conflict: false,
                });
            }
            list_dir(root, &item.path(), out)?;
        } else if Path::new(&name).extension().and_then(|e| e.to_str()) == Some(NOTE_EXT) {
            notes.push((name, false));
        }
    }
    let names: HashSet<&str> = notes.iter().map(|(n, _)| n.as_str()).collect();
    for (name, placeholder) in &notes {
        let conflict = conflict_base(name).is_some_and(|base| names.contains(base.as_str()));
        if let Some(rel) = to_rel(root, &dir.join(name)) {
            out.push(Entry {
                path: rel,
                kind: EntryKind::Note,
                placeholder: *placeholder,
                conflict,
            });
        }
    }
    Ok(())
}

pub fn read(root: &Path, rel: &str) -> Result<NoteContent> {
    let path = resolve_note(root, rel)?;
    if !path.exists() {
        request_download(&path)?;
    }
    let bytes = fs::read(&path).map_err(|e| not_found_or_io(e, rel))?;
    let hash = hash_bytes(&bytes);
    let content = String::from_utf8(bytes).map_err(|_| VaultError::NotUtf8(rel.to_owned()))?;
    Ok(NoteContent { content, hash })
}

/// フロントマターのあるメモの、フロントマターだけを集める。中身が端末に無いメモは
/// ダウンロードさせないよう読まない。読めないメモは飛ばす
pub fn front_matters(root: &Path) -> Result<Vec<FrontMatter>> {
    let mut out = Vec::new();
    for entry in list(root)? {
        if entry.kind != EntryKind::Note || entry.placeholder {
            continue;
        }
        match read_front_matter(&root.join(&entry.path)) {
            Ok(Some(text)) => out.push(FrontMatter {
                path: entry.path,
                text,
            }),
            Ok(None) => {}
            Err(e) => log::warn!("failed to read front matter of {}: {e}", entry.path),
        }
    }
    Ok(out)
}

fn is_fence(line: &str) -> bool {
    line.trim_end_matches([' ', '\t', '\r', '\n']) == "---"
}

/// 先頭の `---` から閉じの `---` までを読む。メモの残りは読まない
fn read_front_matter(path: &Path) -> std::io::Result<Option<String>> {
    let mut reader = BufReader::new(fs::File::open(path)?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    if !is_fence(line.trim_start_matches('\u{feff}')) {
        return Ok(None);
    }
    let mut text = String::new();
    for _ in 1..FRONT_MATTER_MAX_LINES {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            return Ok(None);
        }
        if is_fence(&line) {
            return Ok(Some(text.trim_end_matches(['\r', '\n']).to_owned()));
        }
        text.push_str(&line);
    }
    Ok(None)
}

/// 中身の無い iCloud のファイルなら、ダウンロードを頼んで届くまで待つ
fn request_download(path: &Path) -> Result<()> {
    let (Some(dir), Some(name)) = (path.parent(), path.file_name()) else {
        return Ok(());
    };
    let placeholder = dir.join(format!(
        ".{}{ICLOUD_PLACEHOLDER_EXT}",
        name.to_string_lossy()
    ));
    if !placeholder.exists() {
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        use std::time::{Duration, Instant};
        const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(15);
        std::process::Command::new("brctl")
            .arg("download")
            .arg(path)
            .status()?;
        let started = Instant::now();
        while !path.exists() {
            if started.elapsed() > DOWNLOAD_TIMEOUT {
                return Err(VaultError::DownloadTimeout(path.display().to_string()));
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }
    Ok(())
}

fn not_found_or_io(e: std::io::Error, rel: &str) -> VaultError {
    if e.kind() == std::io::ErrorKind::NotFound {
        VaultError::NotFound(rel.to_owned())
    } else {
        VaultError::Io(e)
    }
}

/// `base_hash` が今のファイルと合うときだけ、置き換えで書く。
/// ファイルが無くなっていたら作り直す。
pub fn write(root: &Path, rel: &str, content: &str, base_hash: Option<&str>) -> Result<String> {
    let path = resolve_note(root, rel)?;
    if let Some(expected) = base_hash
        && path.exists()
    {
        let current = hash_bytes(&fs::read(&path)?);
        if current != expected {
            return Err(VaultError::Conflict {
                path: rel.to_owned(),
                current_hash: current,
            });
        }
    }
    write_atomic(&path, content.as_bytes())?;
    Ok(hash_bytes(content.as_bytes()))
}

/// 同じフォルダの `.` で始まる一時ファイルに書いてから `rename` で置き換える
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let dir = path
        .parent()
        .ok_or_else(|| VaultError::InvalidPath(path.display().to_string()))?;
    fs::create_dir_all(dir)?;
    let name = path
        .file_name()
        .ok_or_else(|| VaultError::InvalidPath(path.display().to_string()))?
        .to_string_lossy();
    let tmp = dir.join(format!(".{name}.treemo-{}.tmp", std::process::id()));
    let result = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&tmp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    Ok(result?)
}

pub fn create(root: &Path, rel: &str) -> Result<String> {
    let path = resolve_note(root, rel)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AlreadyExists {
                VaultError::AlreadyExists(rel.to_owned())
            } else {
                VaultError::Io(e)
            }
        })?;
    Ok(hash_bytes(b""))
}

pub fn rename(root: &Path, from: &str, to: &str) -> Result<()> {
    let src = resolve_note(root, from)?;
    let dst = resolve_note(root, to)?;
    if !src.exists() {
        return Err(VaultError::NotFound(from.to_owned()));
    }
    let case_only = from != to && from.to_lowercase() == to.to_lowercase();
    if dst.exists() && !case_only {
        return Err(VaultError::AlreadyExists(to.to_owned()));
    }
    if let Some(dir) = dst.parent() {
        fs::create_dir_all(dir)?;
    }
    if case_only {
        // APFS は既定で大文字と小文字を区別しないので、別の名前を 1 度挟む
        let via = src.with_file_name(format!(".treemo-rename-{}.tmp", std::process::id()));
        fs::rename(&src, &via)?;
        fs::rename(&via, &dst)?;
    } else {
        fs::rename(&src, &dst)?;
    }
    Ok(())
}

pub fn trash(root: &Path, rel: &str) -> Result<()> {
    let path = resolve_note(root, rel)?;
    if !path.exists() {
        return Err(VaultError::NotFound(rel.to_owned()));
    }
    trash::delete(&path).map_err(|e| VaultError::Trash(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn vault() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn resolve_rejects_paths_outside_the_vault() {
        let dir = vault();
        for rel in ["../x.md", "/etc/passwd", "a/../../x.md", ""] {
            assert!(
                matches!(resolve(dir.path(), rel), Err(VaultError::OutsideVault(_))),
                "{rel}"
            );
        }
    }

    #[test]
    fn resolve_rejects_hidden_components() {
        let dir = vault();
        assert!(matches!(
            resolve(dir.path(), ".git/config.md"),
            Err(VaultError::InvalidPath(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn resolve_rejects_symlinks_leading_outside() {
        let dir = vault();
        let outside = vault();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("link")).unwrap();
        assert!(matches!(
            resolve(dir.path(), "link/x.md"),
            Err(VaultError::OutsideVault(_))
        ));
    }

    #[test]
    fn resolve_accepts_nested_paths() {
        let dir = vault();
        let path = resolve(dir.path(), "a/b/c.md").unwrap();
        assert_eq!(path, dir.path().join("a/b/c.md"));
    }

    #[test]
    fn write_refuses_when_base_hash_differs() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), "external").unwrap();
        let result = write(dir.path(), "a.md", "mine", Some(&hash_bytes(b"old")));
        match result {
            Err(VaultError::Conflict { current_hash, .. }) => {
                assert_eq!(current_hash, hash_bytes(b"external"));
            }
            other => panic!("expected conflict, got {other:?}"),
        }
        assert_eq!(
            fs::read_to_string(dir.path().join("a.md")).unwrap(),
            "external"
        );
    }

    #[test]
    fn write_succeeds_when_base_hash_matches() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), "old").unwrap();
        let hash = write(dir.path(), "a.md", "new", Some(&hash_bytes(b"old"))).unwrap();
        assert_eq!(hash, hash_bytes(b"new"));
        assert_eq!(fs::read_to_string(dir.path().join("a.md")).unwrap(), "new");
    }

    #[test]
    fn write_leaves_no_temporary_files() {
        let dir = vault();
        write(dir.path(), "a.md", "x", None).unwrap();
        let names: Vec<String> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["a.md".to_owned()]);
    }

    #[cfg(unix)]
    #[test]
    fn write_atomic_keeps_the_original_when_it_fails() {
        use std::os::unix::fs::PermissionsExt;
        let dir = vault();
        let sub = dir.path().join("ro");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.md"), "original").unwrap();
        fs::set_permissions(&sub, fs::Permissions::from_mode(0o555)).unwrap();
        let result = write_atomic(&sub.join("a.md"), b"new");
        fs::set_permissions(&sub, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(sub.join("a.md")).unwrap(), "original");
        assert_eq!(fs::read_dir(&sub).unwrap().count(), 1);
    }

    #[test]
    fn list_hides_dot_entries_and_non_notes() {
        let dir = vault();
        fs::create_dir_all(dir.path().join("sub")).unwrap();
        fs::create_dir_all(dir.path().join(".obsidian")).unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();
        fs::write(dir.path().join(".hidden.md"), "").unwrap();
        fs::write(dir.path().join("image.png"), "").unwrap();
        fs::write(dir.path().join("sub/b.md"), "").unwrap();
        fs::write(dir.path().join(".obsidian/c.md"), "").unwrap();
        let paths: Vec<String> = list(dir.path())
            .unwrap()
            .into_iter()
            .map(|e| e.path)
            .collect();
        assert_eq!(paths, vec!["a.md", "sub", "sub/b.md"]);
    }

    #[test]
    fn list_marks_placeholders_and_conflicts() {
        let dir = vault();
        fs::write(dir.path().join(".cloud.md.icloud"), "").unwrap();
        fs::write(dir.path().join("memo.md"), "").unwrap();
        fs::write(dir.path().join("memo 2.md"), "").unwrap();
        fs::write(dir.path().join("plan 2026.md"), "").unwrap();
        let entries = list(dir.path()).unwrap();
        let find = |p: &str| entries.iter().find(|e| e.path == p).unwrap();
        assert!(find("cloud.md").placeholder);
        assert!(find("memo 2.md").conflict);
        assert!(!find("memo.md").conflict);
        assert!(!find("plan 2026.md").conflict);
    }

    #[test]
    fn read_returns_content_and_hash() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), "hello").unwrap();
        let note = read(dir.path(), "a.md").unwrap();
        assert_eq!(note.content, "hello");
        assert_eq!(note.hash, hash_bytes(b"hello"));
    }

    #[test]
    fn front_matters_reads_only_the_leading_block() {
        let dir = vault();
        fs::create_dir_all(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("a.md"), "---\ntags: [x]\n---\n本文\n---\n").unwrap();
        fs::write(
            dir.path().join("sub/b.md"),
            "\u{feff}---\r\ntitle: b\r\n---\r\n",
        )
        .unwrap();
        fs::write(dir.path().join("c.md"), "本文\n---\na: 1\n---\n").unwrap();
        fs::write(dir.path().join("d.md"), "---\na: 1\n").unwrap();
        fs::write(dir.path().join("e.md"), "---\n---\n").unwrap();
        fs::write(dir.path().join(".f.md.icloud"), "").unwrap();
        assert_eq!(
            front_matters(dir.path()).unwrap(),
            vec![
                FrontMatter {
                    path: "a.md".to_owned(),
                    text: "tags: [x]".to_owned(),
                },
                FrontMatter {
                    path: "e.md".to_owned(),
                    text: String::new(),
                },
                FrontMatter {
                    path: "sub/b.md".to_owned(),
                    text: "title: b".to_owned(),
                },
            ]
        );
    }

    #[test]
    fn front_matters_skips_files_that_are_not_utf8() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), b"---\n\xff\n---\n").unwrap();
        assert_eq!(front_matters(dir.path()).unwrap(), vec![]);
    }

    #[test]
    fn create_refuses_existing_files() {
        let dir = vault();
        create(dir.path(), "x/a.md").unwrap();
        assert!(dir.path().join("x/a.md").exists());
        assert!(matches!(
            create(dir.path(), "x/a.md"),
            Err(VaultError::AlreadyExists(_))
        ));
    }

    #[test]
    fn create_refuses_non_markdown() {
        let dir = vault();
        assert!(matches!(
            create(dir.path(), "a.txt"),
            Err(VaultError::InvalidPath(_))
        ));
    }

    #[test]
    fn rename_moves_into_new_folders() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), "x").unwrap();
        rename(dir.path(), "a.md", "sub/b.md").unwrap();
        assert!(!dir.path().join("a.md").exists());
        assert_eq!(
            fs::read_to_string(dir.path().join("sub/b.md")).unwrap(),
            "x"
        );
    }

    #[test]
    fn rename_refuses_to_overwrite() {
        let dir = vault();
        fs::write(dir.path().join("a.md"), "a").unwrap();
        fs::write(dir.path().join("b.md"), "b").unwrap();
        assert!(matches!(
            rename(dir.path(), "a.md", "b.md"),
            Err(VaultError::AlreadyExists(_))
        ));
        assert_eq!(fs::read_to_string(dir.path().join("b.md")).unwrap(), "b");
    }

    #[test]
    fn rename_changes_only_case() {
        let dir = vault();
        fs::write(dir.path().join("memo.md"), "x").unwrap();
        rename(dir.path(), "memo.md", "Memo.md").unwrap();
        let names: Vec<String> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["Memo.md".to_owned()]);
    }
}
