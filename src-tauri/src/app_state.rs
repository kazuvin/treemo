use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::vault::VaultError;

const FILE_NAME: &str = "state.json";

fn state_path(app: &AppHandle) -> Result<PathBuf, VaultError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| VaultError::Io(std::io::Error::other(e.to_string())))?;
    Ok(dir.join(FILE_NAME))
}

/// アプリの状態（最後に開いた保管庫、折りたたみなど）。中身の形は WebView 側が決める
#[tauri::command]
pub async fn app_state_read(app: AppHandle) -> Result<Option<String>, VaultError> {
    match std::fs::read_to_string(state_path(&app)?) {
        Ok(json) => Ok(Some(json)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub async fn app_state_write(app: AppHandle, json: String) -> Result<(), VaultError> {
    crate::vault::write_atomic(&state_path(&app)?, json.as_bytes())
}
