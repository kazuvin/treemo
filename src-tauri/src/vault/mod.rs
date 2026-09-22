pub mod commands;
mod error;
mod fs;
mod watch;

use std::path::PathBuf;
use std::sync::Mutex;

pub use error::VaultError;
pub use fs::write_atomic;

struct OpenVault {
    root: PathBuf,
    recent_writes: watch::RecentWrites,
    _watch: watch::WatchHandle,
}

#[derive(Default)]
pub struct VaultState {
    open: Mutex<Option<OpenVault>>,
}

impl VaultState {
    fn root(&self) -> Result<PathBuf, VaultError> {
        self.open
            .lock()
            .ok()
            .and_then(|open| open.as_ref().map(|v| v.root.clone()))
            .ok_or(VaultError::NotOpen)
    }

    fn remember_write(&self, rel: &str, hash: &str) -> Result<(), VaultError> {
        let guard = self.open.lock().map_err(|_| VaultError::NotOpen)?;
        let open = guard.as_ref().ok_or(VaultError::NotOpen)?;
        let path = fs::resolve(&open.root, rel)?;
        if let Ok(mut writes) = open.recent_writes.lock() {
            writes.insert(path, hash.to_owned());
        }
        Ok(())
    }
}
