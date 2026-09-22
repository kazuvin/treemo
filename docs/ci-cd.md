# CI

## GitHub Actions

`.github/workflows/ci.yml`。`main` への push と pull request で走る。

| ジョブ | ランナー | 中身 |
| --- | --- | --- |
| web | ubuntu | `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build:web` |
| rust | macOS | `cargo fmt --check` → `cargo clippy -D warnings` → `cargo test` |

- rust ジョブを macOS で回すのは、iCloud まわりで macOS だけの API を
  `cfg(target_os = "macos")` の中で呼ぶため。Linux ではそのコードが検査されない。
- `tauri::generate_context!` はビルド時に `frontendDist`（`dist/`）の存在を確かめる。
  rust ジョブは空の `dist/` を作ってから走らせる。
- アプリ本体のビルド（`pnpm build` → `.app` / `.dmg`）は CI では行わない。署名と
  公証を始めるときに、リリース用のワークフローとして別に作る。

## ローカル

```sh
pnpm ci:check
```

CI の 2 つのジョブと同じ内容を 1 本で流す。push の前に必ず通す。

コミット時には lefthook が、ステージしたファイルに対して Oxlint・Oxfmt・rustfmt を
かけ、`tsc` を流す。コミットメッセージは commitlint（Conventional Commits）で検査する。
