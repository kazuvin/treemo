use std::path::PathBuf;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, State};

use super::fs::{self, Entry, FrontMatter, NoteContent};
use super::{OpenVault, VaultError, VaultState, watch};

pub const CHANGED_EVENT: &str = "vault://changed";
/// `attachment_write` で書く先（保管庫からの相対パスを `encodeURIComponent` したもの）
const ATTACHMENT_PATH_HEADER: &str = "x-treemo-path";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    root: String,
    name: String,
}

#[derive(Clone, Serialize)]
struct ChangedPayload {
    paths: Vec<String>,
}

#[tauri::command]
pub async fn vault_open(
    app: AppHandle,
    state: State<'_, VaultState>,
    path: String,
) -> Result<VaultInfo, VaultError> {
    let root = PathBuf::from(&path).canonicalize()?;
    if !root.is_dir() {
        return Err(VaultError::NotFound(path));
    }
    // メモの中の画像を WebView が asset プロトコルで読めるようにする。許すのは保管庫の中だけ
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(|e| VaultError::Io(std::io::Error::other(e.to_string())))?;
    let recent_writes = watch::RecentWrites::default();
    let handle = watch::start(&root, recent_writes.clone(), move |paths| {
        if let Err(e) = app.emit(CHANGED_EVENT, ChangedPayload { paths }) {
            log::error!("failed to emit {CHANGED_EVENT}: {e}");
        }
    })?;
    let info = VaultInfo {
        root: root.display().to_string(),
        name: root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
    };
    let mut open = state.open.lock().map_err(|_| VaultError::NotOpen)?;
    *open = Some(OpenVault {
        root,
        recent_writes,
        _watch: handle,
    });
    Ok(info)
}

#[tauri::command]
pub async fn vault_list(state: State<'_, VaultState>) -> Result<Vec<Entry>, VaultError> {
    fs::list(&state.root()?)
}

/// タグ検索のために、全メモのフロントマターを集める
#[tauri::command]
pub async fn vault_front_matters(
    state: State<'_, VaultState>,
) -> Result<Vec<FrontMatter>, VaultError> {
    fs::front_matters(&state.root()?)
}

/// 保管庫を選ぶダイアログの最初の候補。iCloud Drive があればそこ
#[tauri::command]
pub fn vault_default_dir() -> Option<String> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let icloud = home.join("Library/Mobile Documents/com~apple~CloudDocs");
    let dir = if icloud.is_dir() { icloud } else { home };
    Some(dir.display().to_string())
}

#[tauri::command]
pub async fn note_read(
    state: State<'_, VaultState>,
    rel: String,
) -> Result<NoteContent, VaultError> {
    fs::read(&state.root()?, &rel)
}

#[tauri::command]
pub async fn note_write(
    state: State<'_, VaultState>,
    rel: String,
    content: String,
    base_hash: Option<String>,
) -> Result<String, VaultError> {
    let root = state.root()?;
    let hash = fs::hash_bytes(content.as_bytes());
    // 書く前に覚えておかないと、監視の通知が先に届いて外部の変更と取り違える
    state.remember_write(&rel, &hash)?;
    fs::write(&root, &rel, &content, base_hash.as_deref())
}

#[tauri::command]
pub async fn note_create(state: State<'_, VaultState>, rel: String) -> Result<String, VaultError> {
    fs::create(&state.root()?, &rel)
}

#[tauri::command]
pub async fn note_rename(
    state: State<'_, VaultState>,
    from: String,
    to: String,
) -> Result<(), VaultError> {
    fs::rename(&state.root()?, &from, &to)
}

#[tauri::command]
pub async fn note_duplicate(
    state: State<'_, VaultState>,
    from: String,
    dir: String,
) -> Result<String, VaultError> {
    fs::duplicate(&state.root()?, &from, &dir)
}

#[tauri::command]
pub async fn note_trash(state: State<'_, VaultState>, rel: String) -> Result<(), VaultError> {
    fs::trash(&state.root()?, &rel)
}

/// 貼り付けた画像を書く。中身は JSON にすると大きくなるので、本文にそのまま載せて受け取る
#[tauri::command]
pub async fn attachment_write(
    state: State<'_, VaultState>,
    request: Request<'_>,
) -> Result<String, VaultError> {
    let rel = request
        .headers()
        .get(ATTACHMENT_PATH_HEADER)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| percent_encoding::percent_decode_str(v).decode_utf8().ok())
        .ok_or_else(|| VaultError::InvalidPath(String::new()))?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(VaultError::InvalidPath(rel.into_owned()));
    };
    fs::write_attachment(&state.root()?, &rel, bytes)
}
