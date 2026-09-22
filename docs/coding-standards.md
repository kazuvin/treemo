# コーディング規約

命名と import の書き方、React と Rust の書き方。TS 側は Oxlint で、Rust 側は clippy で機械的に落とす。
ファイルの置き場所と層の境界は [ディレクトリ構成](directory-structure.md) にある。

## リンター / フォーマッター

**Oxlint がリンター、Oxfmt がフォーマッター**で、ESLint と Prettier を置き換えている。
lint の設定は `.oxlintrc.json`（層の境界も `overrides` でここに書く）、整形の設定は
`.oxfmtrc.json`。型情報を使うルール（`no-floating-promises` など）は `oxlint-tsgolint` が
受け持つ。Oxlint の組み込みルールで表せない禁止事項は、自作プラグイン
`tools/oxlint-plugin.mjs`（`treemo/*`）に置いている。

| 対象 | lint | format |
| --- | --- | --- |
| `.ts` / `.tsx` / `.mts` / `.mjs` | Oxlint | Oxfmt |
| `.json` / `.jsonc` / `.css` | — | Oxfmt |
| `.md` / `.yml` | — | 対象外（`.oxfmtrc.json` の `ignorePatterns`） |
| すべての TS | `tsc --noEmit`（型） | — |
| `.rs` | `cargo clippy -D warnings` | `cargo fmt` |

生成物 (`dist/` `coverage/`) と `src-tauri/` を Oxlint の `ignorePatterns` で外している。

### 整形スタイル

シングルクォート・セミコロンなし・行幅 100。JSX の属性と CSS だけダブルクォート。
import の並び替えと Tailwind クラスの整列（`cn()` / `clsx()` の引数を含む）も Oxfmt が行う。

## 命名規則

bulletproof-react に倣い、**ファイル名は React コンポーネントも含めてすべて kebab-case** に
統一する（`file-tree.tsx`、`status-bar.tsx`）。`unicorn/filename-case` で
`kebab-case` のみを許可し、違反は lint で落ちる。

- **ディレクトリ名も kebab-case**。ただし lint が検査するのはファイル名だけなので、
  ディレクトリ名はレビューで担保する。
- フレームワークが名前を固定している設定ファイル（`vite.config.ts` など）だけが例外。

| 種類 | 形 | 例 |
| --- | --- | --- |
| コンポーネント | `kebab-case.tsx` | `file-tree.tsx` |
| フック | `use-kebab-case.ts` | `use-autosave.ts` |
| ストア | `kebab-case-store.ts` | `mode-store.ts` |
| テスト | `*.test.ts` / `*.test.tsx` | `cn.test.ts` |
| Storybook | `*.stories.tsx` | `button.stories.tsx` |

## import の書き方

### barrel（`index.ts`）を置かない

**再エクスポート専用の `index.ts` は作らない。** import は実ファイルを直接指す。
`noBarrelFile` と `noReExportAll` で lint に落とす。

```ts
import { Card, CardHeader } from '@/components/ui/card'  // OK
import { Card, CardHeader } from '@/components/ui'       // NG
```

理由は **knip が export 単位で未使用を追跡できなくなる**こと。barrel を経由すると
「エントリから参照されている」とだけ見え、どの export が実際に使われているかを
knip が判定できない。再エクスポートの連鎖が循環参照の温床になりやすいのも避けたい点。

### 自前モジュールは flat named import で参照する

`import * as X from '@/...'` は lint で落ちる。外部ライブラリは対象外
（Storybook の `setProjectAnnotations` のように、公式 API が名前空間オブジェクトを
要求する場合だけ `oxlint-disable-next-line treemo/no-namespace-import -- 理由` で個別に外す）。
動的 `import()` も名前空間の取り込みとして同じルールが拾う。

- 自前モジュールの判定は `./` `../` `@/` で始まる**パス形式**で行う（`treemo/no-namespace-import`）。
- エイリアスは `@/*` の 1 系統に固定する。import 制限は文字列マッチで動くため、
  エイリアスを増やすと境界チェックに穴が開く。

### 共有 UI は 1 ファイルに flat named export

Compound Components は**パーツを 1 ファイルにまとめて flat named export** する
（Radix UI と同じ形）。`Card.Header` ではなく `CardHeader`。

```
src/components/ui/card.tsx        Card / CardHeader / CardTitle / ... を 1 ファイルで
src/components/ui/card.stories.tsx
```

`src/components/ui/**` には `useComponentExportOnlyModules` を掛けており、
**コンポーネント以外の値を export できない**。Radix のプリミティブを公開するときも
`const Dialog = DialogPrimitive.Root` の別名ではなく、薄い関数コンポーネントで包む。

禁じられているのは **export** であって、ファイルの中身ではない。variant のクラス定数や
ヘルパーは private な `const` / `function` として同じファイルに置く。ファイルを分けると
本来不要な `export` が必要になり、公開する名前が増えてしまう。他のコンポーネントからも
使うようになったら、そのとき `lib/` へ引き上げる。

## React の書き方

React 19 + React Compiler（Vite）。`.oxlintrc.json` が機械的に落とすのは次のとおり。

- **`import * as React` / `import React` は禁止**。必要な API は named import で取り込む
  （`import type { ComponentProps, ReactNode } from 'react'`）。JSX の変換に React の
  import は不要で、`React.forwardRef` のような旧 API への入口にもなるため。
- **`forwardRef` は使わない**。React 19 では `ref` が通常の props になった。
- **`FC` / `FunctionComponent` / `PropsWithChildren` は使わない**。props の型は引数に
  直接書き、`children` を取るなら `children: ReactNode` と明示する。
- **クラスコンポーネントは使わない**（`componentDidCatch` を持つエラーバウンダリのみ例外）。
- **`<></>` に統一する**。`React.Fragment` を書くのは `key` を渡すときだけ。
- **`Children` / `cloneElement` は使わない**。children の構造に依存するので、
  context か render prop に置き換える。
- **`props` を書き換えない**（`react/immutability`）。React Compiler でもハードエラーになる。
- **配列の添字を `key` にしない**。並べ替えや挿入で state が別の行に付く。
- **`dangerouslySetInnerHTML` を使わない**。メモはユーザーのファイルそのもので、
  HTML を生で差し込むと XSS の入口になる。Markdown の描画は CodeMirror の装飾で行う。
- **`useMemo` / `useCallback` / `memo` を手で足さない**。再レンダーの抑制は React Compiler に
  任せる。まず本当に遅いのかを測る。

## Rust の書き方

- `cargo fmt` で整形し、`cargo clippy --all-targets -- -D warnings` を通す。
- **コマンドの中で `unwrap` / `expect` を使わない**。失敗は `thiserror` で型にしたエラーを
  `Result` で返し、WebView 側で扱う。`expect` を使ってよいのは起動時に 1 度だけ走る
  ところ（`lib.rs` の Builder）だけ。
- `#[tauri::command]` の関数は薄く保ち、中身は Tauri に依存しない関数に置いてテストする
  （[ディレクトリ構成](directory-structure.md) の `src-tauri/`）。

## コメント

**設計の説明は `docs/` に置き、コードにはコピーしない。** 同じ内容が 2 箇所にあると
必ず片方が腐ります。kazuvin.me では、ディレクトリを移すたびに、同じ説明をファイル冒頭と
`docs/directory-structure.md` の両方で直す必要がありました。

コードに残してよいのは、**そのファイルを開いた人がコードだけでは復元できないもの**に
限ります。目安は 1〜3 行です。

| 残す | 消す |
| --- | --- |
| 数字の導出 (`624 = 576 + 24 × 2`) | 構造・層・命名の説明 (docs にある) |
| 選ばなかった選択肢と、その理由 | コードを日本語で言い直しただけの行 |
| 外すと壊れる制約 (`Fragment を <div> にすると grid が潰れる`) | 型から読める JSDoc (`/** タイトル */ title: string`) |
| lint の抑制コメントの理由 (`oxlint-disable-next-line ... -- 理由`) | 変更の経緯・実測ログ |

ファイル冒頭に長い解説を置かないでください。書きたくなったら、それは docs に
足りていない節がある合図です。docs 側に書いて、コードからは 1 行で参照します。

## 失敗の伝え方

**宛先が 2 つあるので、混ぜない。**

| 宛先 | 手段 | 使う場面 |
| --- | --- | --- |
| 開発者 | `console.error`（TS）/ `log`（Rust） | 原因を追うための情報 |
| 利用者 | 画面の表示 | 保存できなかった、外部で変更された、など |

- **`console.error` を利用者向けの表示に置き換えない。併置する。** 利用者向けの文言だけを
  残すと、調査の手がかり（元のエラー）が消える。
- **消えては困ることはトーストにしない。** 保存の失敗や外部変更による衝突のように、
  利用者が対応を選ぶ必要があるものは、エディタの上にその場で出す。トーストは消える。
- **失敗を色だけで伝えない。** Kotoba には赤や緑のステータス色が無い。言葉と位置で伝える。

## 日付の扱い

**日付を組み立てる入口は `src/lib/date.ts` だけ。** 生の `new Date()` と `Date.now()` は
自作の Oxlint プラグイン（`tools/oxlint-plugin.mjs` の `treemo/no-raw-date`）で lint に落とす。

- `src/lib/date.ts` はまだ無い。最初に日付が要ったとき（ファイルの更新時刻の表示など）に作る。
- 例外は `.oxlintrc.json` の `overrides` で外してある。`lib/date.ts` 本体と、テスト。
- 個別に外したい行には `// oxlint-disable-next-line treemo/no-raw-date -- 理由` を置く。

## 未使用コードの検出

`pnpm knip` で未使用のファイル・export・依存を洗い出す。barrel を置かない構成なので、
export 単位まで追跡できる。CI には入れておらず、手動で回す棚卸し用。
