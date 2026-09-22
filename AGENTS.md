# AGENTS.md

Treemo: キーボードだけで書き終えられる macOS 向けの Markdown メモアプリ。
Vim で書け、メモの中にロジックツリーをキー操作で組み立てられる（Tauri 2 + React）。

## 最初に読む

- 何を作るか: `docs/requirements.md`
- どう作るか: `docs/architecture.md`
- 次に何をするか: `docs/roadmap.md`（上から順に進める。タスクごとに「読む」文書がある）

## ブランチ

- 開発は `main` のみ。作業ブランチもフォークも作らず、`main` に直接コミットする。

## push 前

- push の前に必ず `pnpm ci:check` をローカルで通す。1 つでも落ちたら push しない。
- `pnpm ci:check` は lint → typecheck → test → build:web → rust:check の順に走り、
  GitHub Actions の CI と同じ内容を再現する。

## 文書

- 要件・設計・キー割り当て・記法を変えたら、コードと同じコミットで `docs/` も直す。
- ロードマップのタスクを終えたら `docs/roadmap.md` のチェックボックスを付ける。
- `docs/requirements.md` の「決まっていないこと」を決めたら、決定の表へ移す。

## コメント

- 残す価値があるときだけ書く（linter を無視せざるを得ない理由など、コードを読んでも
  復元できない「なぜ」）。コードが言っていることを言い換えるコメントは書かない。
- 設計の説明は `docs/` に置き、コードにコピーしない。

## 動かして確かめる

- `pnpm dev` で Tauri のウィンドウが開く（Vite の dev サーバーも一緒に起きる）。
- WebView の画面だけを見るなら `pnpm dev:web`（http://localhost:1420）。この場合 Rust の
  コマンドは呼べないので、保管庫に触る画面は動かない。
