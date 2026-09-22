use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("保管庫が開かれていません")]
    NotOpen,
    #[error("保管庫の外を指すパスです: {0}")]
    OutsideVault(String),
    #[error("使えないパスです: {0}")]
    InvalidPath(String),
    #[error("見つかりません: {0}")]
    NotFound(String),
    #[error("すでにあります: {0}")]
    AlreadyExists(String),
    #[error("外部で変更されています: {path}")]
    Conflict { path: String, current_hash: String },
    #[error("UTF-8 のテキストではありません: {0}")]
    NotUtf8(String),
    #[error("iCloud からのダウンロードが終わりません: {0}")]
    DownloadTimeout(String),
    #[error("ゴミ箱に入れられませんでした: {0}")]
    Trash(String),
    #[error("ファイルの監視を始められませんでした: {0}")]
    Watch(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl VaultError {
    fn kind(&self) -> &'static str {
        match self {
            Self::NotOpen => "notOpen",
            Self::OutsideVault(_) => "outsideVault",
            Self::InvalidPath(_) => "invalidPath",
            Self::NotFound(_) => "notFound",
            Self::AlreadyExists(_) => "alreadyExists",
            Self::Conflict { .. } => "conflict",
            Self::NotUtf8(_) => "notUtf8",
            Self::DownloadTimeout(_) => "downloadTimeout",
            Self::Trash(_) => "trash",
            Self::Watch(_) => "watch",
            Self::Io(_) => "io",
        }
    }
}

/// WebView には `{ kind, message }`（衝突なら `currentHash` も）の形で渡す
impl Serialize for VaultError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("VaultError", 3)?;
        s.serialize_field("kind", self.kind())?;
        s.serialize_field("message", &self.to_string())?;
        if let Self::Conflict { current_hash, .. } = self {
            s.serialize_field("currentHash", current_hash)?;
        }
        s.end()
    }
}
