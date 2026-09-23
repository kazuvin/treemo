use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use super::fs::{self, Entry, FrontMatter, NoteContent};
use super::{OpenVault, VaultError, VaultState, watch};

pub const CHANGED_EVENT: &str = "vault://changed";

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
pub async fn note_trash(state: State<'_, VaultState>, rel: String) -> Result<(), VaultError> {
    fs::trash(&state.root()?, &rel)
}
