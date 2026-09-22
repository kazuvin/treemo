---
paths:
  - "src-tauri/**"
---

# src-tauri を触るときのルール

- 読む文書: `docs/vault.md`（保管庫の読み書き）、`docs/architecture.md`（役割の分け方と IPC）、
  `docs/coding-standards.md` の「Rust の書き方」。
- Rust が持つのは OS に触るものだけ。解析や描画のロジックを持ち込まない。
- `#[tauri::command]` は薄く保ち、中身は Tauri に依存しない関数に置いて `cargo test` で確かめる。
- コマンドの中で `unwrap` / `expect` を使わない。`thiserror` の型で `Result` を返す。
- WebView に許す権限（`capabilities/`）は使うものだけを足す。
- 変更後は `pnpm rust:check`（fmt --check / clippy -D warnings / test）を通す。
