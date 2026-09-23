mod app_state;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(vault::VaultState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault::commands::vault_open,
            vault::commands::vault_list,
            vault::commands::vault_default_dir,
            vault::commands::note_read,
            vault::commands::note_write,
            vault::commands::note_create,
            vault::commands::note_rename,
            vault::commands::note_trash,
            app_state::app_state_read,
            app_state::app_state_write,
            app_state::keybindings_read,
            app_state::keybindings_open,
            app_state::keybindings_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
