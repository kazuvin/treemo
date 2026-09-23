# ディレクトリ構成

ファイルの置き場所と、層をまたぐ import の規則。層の規則は `.oxlintrc.json` の
`overrides` で機械的に落とす。構成の考え方は kazuvin.me（bulletproof-react に倣ったもの）を
引き継いでいる。

## ルート

```
treemo/
├── src/                 WebView で動く側（React）
├── src-tauri/           Rust 側（Tauri）
├── tools/               自作の Oxlint プラグイン
├── docs/                要件・設計・規約
├── index.html           Vite のエントリ
├── vite.config.ts       Vite（React Compiler / Tailwind）
└── vitest.config.mts    単体テスト
```

## src/

```
src/
├── main.tsx             エントリ。フォントと globals.css を読み、App を描く
├── app/                 合成層。features をつなぎ、画面の骨格を作る
├── assets/              画像などの静的ファイル（テーマの背景の写真は backdrops/、BGM は ambience/）
├── components/
│   ├── ui/              UI の部品（Kotoba）。props だけで動く最下層
│   └── layouts/         画面の外枠（サイドバー、ステータスバー、grid）
├── features/
│   └── <domain>/        vault / editor / tree / commands
│       ├── api/         Rust コマンドを呼ぶ薄い関数（vault だけが持つ想定）
│       ├── components/
│       ├── extensions/  CodeMirror の拡張
│       ├── hooks/
│       ├── stores/
│       ├── types/
│       └── utils/       純粋な関数（解析・配置など）
├── hooks/               feature をまたぐフック
├── lib/                 feature をまたぐ関数と型（cn、command の型など）
├── stores/              feature をまたぐ状態（mode-store など）
└── styles/              globals.css（Kotoba のトークン）
```

## 層の向き

依存は **共有層 → features → app / layouts** の一方向に限る。

| 層 | ディレクトリ | import してよいもの |
| --- | --- | --- |
| 共有層 | `components/ui` `lib` `hooks` `stores` `config` `assets` | 共有層だけ |
| features | `features/<domain>` | 共有層と、自分の feature の中 |
| layouts | `components/layouts` | 共有層と features |
| app | `app` | すべて |

- **feature どうしは import しない。** つなぐのは `app/` の役目。エディタにツリーを載せる
  例は [設計](architecture.md) の「feature どうしのつなぎ方」にある。
- **`components/ui` はさらに狭い。** features・stores・他の components を知らず、状態は
  props で受け取る。
- **親をさかのぼる相対 import は制限する。** feature のサブディレクトリから `../` で
  1 階層上がるのはよいが、`../../` で feature の外に出るのは禁止。共有層は `@/` で指す。
- **`src/` に Node のビルトインを持ち込まない。** OS に触る処理は Rust のコマンドに置く。

## src-tauri/

```
src-tauri/
├── src/
│   ├── main.rs          起動するだけ
│   ├── lib.rs           Tauri の Builder。コマンドとプラグインの登録
│   ├── app_state.rs     アプリの状態とキーの割り当て（Application Support の state.json・keybindings.json）
│   └── vault/
│       ├── mod.rs       開いている保管庫の状態
│       ├── commands.rs  #[tauri::command]。薄く保つ
│       ├── error.rs     WebView に { kind, message } で返すエラー
│       ├── fs.rs        パスの検査・置き換え保存など。Tauri に依存しない
│       └── watch.rs     ファイル監視
├── capabilities/        WebView に許す権限
├── icons/               アプリのアイコン（今は tauri init の仮のもの）
└── tauri.conf.json
```

- `#[tauri::command]` の関数は引数を受け取り、Tauri に依存しない関数を呼ぶだけにする。
  テストは Tauri に依存しない側に書く。
- WebView に許す権限（`capabilities/`）は、使うものだけを足す。

## 命名

| 種類 | 形 | 例 |
| --- | --- | --- |
| ファイル・ディレクトリ（TS） | kebab-case | `tree-extension.ts` |
| コンポーネント | `kebab-case.tsx` | `file-tree.tsx` |
| フック | `use-kebab-case.ts` | `use-autosave.ts` |
| ストア | `kebab-case-store.ts` | `mode-store.ts` |
| テスト | `*.test.ts` / `*.test.tsx`（対象と同じ場所） | `parse.test.ts` |
| Rust | Rust の慣習（snake_case） | `watch.rs` |

`index.ts` の barrel は置かない。import は実ファイルを直接指す。
