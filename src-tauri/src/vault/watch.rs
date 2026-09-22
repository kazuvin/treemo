use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};

use super::error::VaultError;
use super::fs::hash_bytes;

/// 短い間に続いた変更を 1 回の通知にまとめる待ち時間
const DEBOUNCE: Duration = Duration::from_millis(150);

/// 自分で書いたファイルと、そのときの中身のハッシュ
pub type RecentWrites = Arc<Mutex<HashMap<PathBuf, String>>>;

/// 落とすと監視が止まる
pub struct WatchHandle {
    _watcher: RecommendedWatcher,
}

pub fn start(
    root: &Path,
    recent_writes: RecentWrites,
    on_change: impl Fn(Vec<String>) + Send + 'static,
) -> Result<WatchHandle, VaultError> {
    let (tx, rx) = mpsc::channel::<PathBuf>();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if let Ok(event) = event {
            for path in event.paths {
                let _ = tx.send(path);
            }
        }
    })
    .map_err(|e| VaultError::Watch(e.to_string()))?;
    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|e| VaultError::Watch(e.to_string()))?;

    let root = root.canonicalize()?;
    std::thread::spawn(move || {
        let mut pending: BTreeSet<PathBuf> = BTreeSet::new();
        loop {
            match rx.recv_timeout(DEBOUNCE) {
                Ok(path) => {
                    pending.insert(path);
                }
                Err(RecvTimeoutError::Timeout) => {
                    if pending.is_empty() {
                        continue;
                    }
                    let paths: Vec<String> = std::mem::take(&mut pending)
                        .into_iter()
                        .filter(|p| !is_own_write(p, &recent_writes))
                        .filter_map(|p| visible_rel(&root, &p))
                        .collect::<BTreeSet<_>>()
                        .into_iter()
                        .collect();
                    if !paths.is_empty() {
                        on_change(paths);
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    Ok(WatchHandle { _watcher: watcher })
}

fn is_own_write(path: &Path, recent_writes: &RecentWrites) -> bool {
    let Ok(mut writes) = recent_writes.lock() else {
        return false;
    };
    let Some(expected) = writes.get(path) else {
        return false;
    };
    match std::fs::read(path) {
        Ok(bytes) if &hash_bytes(&bytes) == expected => true,
        _ => {
            writes.remove(path);
            false
        }
    }
}

/// 一覧に出るもの（`.` で始まらないもの）だけを、保管庫からの相対パスにする。
/// iCloud のプレースホルダーは元の名前にする。
fn visible_rel(root: &Path, path: &Path) -> Option<String> {
    let canonical = path
        .parent()
        .and_then(|dir| dir.canonicalize().ok())
        .map(|dir| dir.join(path.file_name().unwrap_or_default()))
        .unwrap_or_else(|| path.to_path_buf());
    let rel = canonical.strip_prefix(root).ok()?;
    let mut parts: Vec<String> = Vec::new();
    let count = rel.components().count();
    for (i, component) in rel.components().enumerate() {
        let name = component.as_os_str().to_string_lossy().into_owned();
        if name.starts_with('.') {
            let target = name
                .strip_prefix('.')
                .and_then(|n| n.strip_suffix(".icloud"))
                .filter(|n| n.ends_with(".md"));
            match target {
                Some(target) if i + 1 == count => parts.push(target.to_owned()),
                _ => return None,
            }
        } else {
            parts.push(name);
        }
    }
    (!parts.is_empty()).then(|| parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visible_rel_skips_hidden_and_maps_placeholders() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::create_dir(root.join("sub")).unwrap();
        assert_eq!(
            visible_rel(&root, &root.join("sub/a.md")),
            Some("sub/a.md".to_owned())
        );
        assert_eq!(visible_rel(&root, &root.join(".a.md.treemo-1.tmp")), None);
        assert_eq!(
            visible_rel(&root, &root.join("sub/.b.md.icloud")),
            Some("sub/b.md".to_owned())
        );
    }

    #[test]
    fn own_writes_are_ignored_until_the_content_changes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.md");
        std::fs::write(&path, "mine").unwrap();
        let writes: RecentWrites = Arc::default();
        writes
            .lock()
            .unwrap()
            .insert(path.clone(), hash_bytes(b"mine"));
        assert!(is_own_write(&path, &writes));
        std::fs::write(&path, "theirs").unwrap();
        assert!(!is_own_write(&path, &writes));
    }
}
