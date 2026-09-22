# Treemo

キーボードだけで書き終えられる macOS 向けの Markdown メモアプリ。

- Vim で書ける（CodeMirror 6 + Vim キーバインド）
- メモの中に ```` ```tree ```` のブロックでロジックツリーを埋め込み、キー操作だけで組み立てられる
- メモはただの `.md` ファイル。iCloud Drive のフォルダを保管庫にして端末間で同期する

いまは雛形と設計の段階。何を作るかは [要件定義](docs/requirements.md)、進み具合は
[ロードマップ](docs/roadmap.md) にある。

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| デスクトップ | Tauri 2（Rust） |
| UI | React 19 + React Compiler + Tailwind CSS v4（Vite） |
| エディタ | CodeMirror 6 + `@replit/codemirror-vim`（M2 で導入） |
| デザインシステム | Kotoba（kazuvin.me から移植。`docs/kotoba-design-system.md`） |
| テスト | Vitest / `cargo test` |
| lint / format | Oxlint（型情報ルール込み）+ Oxfmt / clippy + rustfmt |

## 開発

Node と pnpm のバージョンは `mise.toml` に固定してある。Rust は stable を使う。

```sh
mise install
pnpm install      # lefthook のフックもここで入る
pnpm dev          # Tauri のウィンドウを開く
```

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | Tauri で起動（Vite の dev サーバーも起きる） |
| `pnpm dev:web` | WebView の画面だけをブラウザで開く（http://localhost:1420） |
| `pnpm build` | `.app` / `.dmg` を作る |
| `pnpm build:web` | WebView の成果物だけを `dist/` に作る |
| `pnpm lint` / `pnpm lint:fix` | Oxlint + Oxfmt |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm rust:check` | `cargo fmt --check` / `clippy` / `test` |
| `pnpm ci:check` | CI と同じ内容をまとめて流す（push 前に必ず通す） |
| `pnpm knip` | 未使用のファイル・export・依存の棚卸し |

## 文書

| 文書 | 内容 |
| --- | --- |
| [要件定義](docs/requirements.md) | 何を作るか。決まったことと決まっていないこと |
| [設計](docs/architecture.md) | Rust と WebView の役割、状態の置き場所、コマンド |
| [ツリーブロック](docs/tree-block.md) | 記法、書き戻しの規則、レイアウト |
| [キー操作](docs/keybindings.md) | モード、キー割り当て、手がかりの表示 |
| [保管庫と iCloud](docs/vault.md) | 読み書き、監視、iCloud の注意点 |
| [ロードマップ](docs/roadmap.md) | MVP までのタスク |
| [ディレクトリ構成](docs/directory-structure.md) / [コーディング規約](docs/coding-standards.md) / [テスト](docs/testing.md) / [CI](docs/ci-cd.md) | 規約 |
| [Kotoba Design System](docs/kotoba-design-system.md) | 色・書体・余白のトークン |
