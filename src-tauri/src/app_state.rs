use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::vault::VaultError;

const STATE_FILE: &str = "state.json";
const KEYBINDINGS_FILE: &str = "keybindings.json";
const KEYBINDINGS_TEMPLATE: &str = "{\n}\n";

fn data_path(app: &AppHandle, name: &str) -> Result<PathBuf, VaultError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| VaultError::Io(std::io::Error::other(e.to_string())))?;
    Ok(dir.join(name))
}

fn read_optional(path: &Path) -> Result<Option<String>, VaultError> {
    match std::fs::read_to_string(path) {
        Ok(json) => Ok(Some(json)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// 無ければ `template` で作る。あればそのまま残す
fn ensure_file(path: &Path, template: &str) -> Result<(), VaultError> {
    if path.exists() {
        return Ok(());
    }
    write_creating_parents(path, template)
}

/// アプリの状態（最後に開いた保管庫、折りたたみなど）。中身の形は WebView 側が決める
#[tauri::command]
pub async fn app_state_read(app: AppHandle) -> Result<Option<String>, VaultError> {
    read_optional(&data_path(&app, STATE_FILE)?)
}

#[tauri::command]
pub async fn app_state_write(app: AppHandle, json: String) -> Result<(), VaultError> {
    crate::vault::write_atomic(&data_path(&app, STATE_FILE)?, json.as_bytes())
}

fn write_creating_parents(path: &Path, content: &str) -> Result<(), VaultError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    crate::vault::write_atomic(path, content.as_bytes())
}

/// キーの割り当ての上書き。手で書いても、設定画面から書いてもよい
#[tauri::command]
pub async fn keybindings_read(app: AppHandle) -> Result<Option<String>, VaultError> {
    read_optional(&data_path(&app, KEYBINDINGS_FILE)?)
}

#[tauri::command]
pub async fn keybindings_write(app: AppHandle, json: String) -> Result<(), VaultError> {
    write_creating_parents(&data_path(&app, KEYBINDINGS_FILE)?, &json)
}

/// keybindings.json を既定のテキストエディタで開く。無ければ空の形で作る
#[tauri::command]
pub async fn keybindings_open(app: AppHandle) -> Result<(), VaultError> {
    let path = data_path(&app, KEYBINDINGS_FILE)?;
    ensure_file(&path, KEYBINDINGS_TEMPLATE)?;
    std::process::Command::new("open")
        .arg("-t")
        .arg(&path)
        .spawn()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_file_creates_missing_parents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join(KEYBINDINGS_FILE);
        ensure_file(&path, KEYBINDINGS_TEMPLATE).unwrap();
        assert_eq!(
            read_optional(&path).unwrap().as_deref(),
            Some(KEYBINDINGS_TEMPLATE)
        );
    }

    #[test]
    fn ensure_file_keeps_existing_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(KEYBINDINGS_FILE);
        std::fs::write(&path, "{\"a\": []}").unwrap();
        ensure_file(&path, KEYBINDINGS_TEMPLATE).unwrap();
        assert_eq!(
            read_optional(&path).unwrap().as_deref(),
            Some("{\"a\": []}")
        );
    }

    #[test]
    fn read_optional_is_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read_optional(&dir.path().join("none.json")).unwrap(), None);
    }
}
