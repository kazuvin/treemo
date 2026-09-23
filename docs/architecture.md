# 設計

Treemo をどう組み立てるか。何を作るかは [要件定義](requirements.md)、ファイルの置き場所と
層の規則は [ディレクトリ構成](directory-structure.md) にある。

## 全体像

```
┌──────────────── WebView（React / src/） ────────────────┐
│  app（合成）                                             │
│   ├─ layouts: サイドバー / エディタ枠 / ステータスバー   │
│   └─ features                                            │
│       vault   ─ ファイル一覧・スイッチャー・自動保存     │
│       editor  ─ CodeMirror 6 + Vim + ライブプレビュー    │
│       tree    ─ ツリーブロックの解析・配置・TREE モード  │
│       commands─ コマンド登録・パレット・which-key・ヒント│
└───────────────┬──────────────────────────────────────────┘
                │ invoke（コマンド） / event（vault://changed）
┌───────────────┴──── Rust（src-tauri/） ──────────────────┐
│  vault: 読み書き・置き換え保存・監視・ゴミ箱・iCloud      │
│  state: アプリの状態（Application Support に保存）        │
└──────────────────────────────────────────────────────────┘
                │
        iCloud Drive 上の保管庫（.md ファイル）
```

## 役割の分け方

- **Rust は OS に触るものだけを持つ。** ファイル、監視、ゴミ箱、ダイアログ、iCloud の API。
  理由は [保管庫と iCloud](vault.md) の「読み書きの窓口」。
- **それ以外はすべて WebView 側に置く。** Markdown とツリーの解析、配置、描画、キー操作。
  テストが速く書け、将来 iOS に広げるときにもそのまま持っていける。
- Rust のコマンド関数は薄くする。中身は Tauri に依存しない普通の関数に置き、
  `cargo test` で一時フォルダを使って確かめる。

### IPC の型

- Rust 側は `serde` で JSON にし、エラーは `thiserror` で型にしてから文字列ではなく
  `{ kind, message }` の形で返す。
- TS 側は `features/vault/api/` にコマンドごとの薄い関数を置き、受け取った値を `zod` で
  検証する。型を 2 か所で書くことになるが、MVP のコマンド数（10 前後）なら手で揃える方が
  依存が少ない。数が増えたら `tauri-specta` での型生成を検討する。

## 1 本の文書、1 本の履歴

いちばん大事な設計上の決まり。

- **開いているメモの正本は CodeMirror の文書（`EditorState.doc`）だけ。** React の state や
  Zustand にメモの本文を複製しない。
- **TREE モードもテキストを書き換える。** ノードの操作は、該当ブロックを正規形の
  テキストに置き換える CodeMirror のトランザクションとして発行する
  （[ツリーブロック](tree-block.md) の「書き戻し」）。
  - 取り消しの履歴が 1 本になり、TREE モードの中と外で `u` が同じように効く。
  - 自動保存、外部変更の取り込み、衝突の判定が、テキストだけを見れば済む。
- ツリーは文書から毎回作り直す値として扱う。文書が変わるたびに行を走査してフェンスを探し
  （`features/tree/utils/find-blocks.ts`）、変わったブロックだけを解析し直す（文字列をキーに
  解析結果を覚えておく）。
  - 構文木を使わないのは、構文木が見えている範囲の近くまでしか解析されていないことがあり、
    ブロックの Decoration（メモ全体に対して必要）の元にできないため。1 万行の走査で 1 文字の
    入力あたり数 ms に収まっている（ロードマップの 6-2）。

### ツリーの描画

- ブロックの絵は CodeMirror の `WidgetType`（置き換えの Decoration）で差し込む。
  ウィジェットの中に小さな React のルートを作って描く。`eq()` を正しく書き、
  関係の無い入力のたびに作り直さないようにする。状態が変わったときは `updateDOM` で
  同じルートに描き直す（ノード編集中の小さなエディタを保つため）。
- ノード編集の小さなエディタはウィジェットの中に置く。本文のエディタはウィジェットの中の
  イベントと DOM の変化を無視する（`ignoreEvent`）ので、キーは小さなエディタだけが受ける。
  本文のエディタのテーマは子孫セレクタで効くため、小さなエディタの側で余白などを打ち消している。
- 全画面の表示は、エディタの上に重ねる React の画面にする。中身はウィジェットと同じ
  部品を使い、状態も同じもの（次節）を見る。
- レイアウトは `(ツリー, ノードの大きさ) → 位置` の純粋な関数（`features/tree/utils/`）。
  ノードの大きさは描いてから測る。大きさは中身だけで決まるので中身をキーに覚え、操作で
  ノードの ID がずれても測り直さない。

## 状態の置き場所

| 状態 | 置き場所 | 理由 |
| --- | --- | --- |
| メモの本文 | CodeMirror の文書 | 正本を 1 つにする |
| TREE モードで選んでいるノード、全画面かどうか | CodeMirror の `StateField` | 文書の変更と同じトランザクションで動かせる。ノードの位置は文書の変更に合わせて付け替える |
| 折りたたみ（見出し・リスト・ノード） | CodeMirror の `StateField` + アプリの状態として保存 | ファイルには書かない（要件の「持ち運べること」） |
| 今のモード（NORMAL / INSERT / VISUAL / TREE）、ブロックの上か、フォーカスのある領域 | `src/stores/mode-store.ts`（Zustand） | ステータスバー・which-key・キーの振り分けなど、エディタの外が読む。本文のエディタとツリーの拡張が書く |
| TREE モード中のブロックの写し、全画面・案内の設定 | `features/tree/stores/tree-store.ts` | 全画面の表示が読む。正本は `StateField` の方で、拡張がここへ流す |
| 選んでいるテーマ、カスタムのプリセット | `src/stores/theme-store.ts` + アプリの状態として保存 | app が購読して `<html>` の `data-theme` と色の変数に書く（[Kotoba](kotoba-design-system.md) の「テーマ」） |
| ステータスバーの短い知らせ | `src/stores/status-store.ts` | 次のキーで消える。消えては困る知らせ（衝突・保存の失敗）はここに出さない |
| アプリの状態の保存（最後の保管庫、折りたたみなど） | `src/app/persisted-state.ts` → Rust の `app_state_read` / `app_state_write` | 保管庫の外（Application Support）に JSON で置く |
| 開いている保管庫、ファイル一覧、開いているメモのパス | `features/vault/stores/` | vault の中で閉じる |
| コマンドの登録、キーの割り当て | `features/commands/` | 下の「コマンド」 |
| キーの割り当ての上書き | Application Support の `keybindings.json` → Rust の `keybindings_read` / `keybindings_write`。`src/app/commands.ts` が既定の登録に重ねる | 手で書いても設定画面から書いてもよい。アプリが書くのは既定との差分だけ（[キー操作](keybindings.md) の「割り当てを変える」） |
| サイドバーの位置（左右）、設定画面を開いているか | `src/app/ui-store.ts`（位置はアプリの状態として保存） | レイアウトと、向きで指すキー（`<C-w>h` など）の行き先を決める |

## コマンド

すべての操作をコマンドとして 1 か所に登録する（要件の F-UX-1）。パレット、which-key、
ツールチップ、キー一覧は、どれもこの登録から作る。キーの割り当てと表示が食い違わない
ようにするため。

```ts
// src/lib/command.ts（共有層。どの feature からも使う）
interface Command {
  id: string // 'tree.addChild' のように <feature>.<動作>
  title: string // パレットに出す名前
  keys?: { scope: KeyScope; sequence: string; passive?: boolean }[] // 'Tab'、'<Space>tn' など
  when?: (ctx: CommandContext) => boolean // 使える状況
  run: (ctx: CommandContext) => void
}
```

- `scope` はキーが効く範囲（`global` / `normal` / `editor` / `sidebar` / `block` / `tree`）。
  意味は [キー操作](keybindings.md) の「コマンドとキーの範囲」。
- キーはすべて `features/commands/hooks/use-key-dispatcher.ts` が `window` の capture で先に
  受ける。今どの範囲が効くかは `src/app/keys.ts` が mode-store から決める。コマンドに
  当たったキーだけを止め、当たらなかったキーは CodeMirror と Vim に届く。
- `passive` は Vim 側で割り当ててあるキー（`za` や `:w`）。振り分けには使わず、パレットと
  キー一覧に出すだけ。

- 各 feature は自分のコマンドを「データ」として export するだけにする。
- `app/` がそれらを集めて `features/commands` の登録に渡す。feature どうしが import
  し合わないための形（層の規則は [ディレクトリ構成](directory-structure.md)）。
- Vim の中で完結するキー（`dd` や `ciw`）はコマンドにしない。`@replit/codemirror-vim` の
  `Vim.defineEx` や `Vim.map` で足すもの（`:e`、`za` の拡張）は、コマンドを呼ぶだけの薄い
  割り当てにする。

## feature どうしのつなぎ方

feature は他の feature を import できない。エディタにツリーの機能を載せるのは `app/` の役目になる。

```tsx
// src/app/app.tsx
import { Editor } from '@/features/editor/components/editor'
import { treeExtension } from '@/features/tree/extensions/tree-extension'

const editorExtensions = [treeExtension(), notes.extension]
<Editor extensions={editorExtensions} onReady={attachEditor} />
```

- 開いているメモの読み書き（エディタとファイルをつなぐ）は `src/app/note-controller.ts` が
  受け持つ。保存の時機と衝突の判定は `features/vault/utils/note-session.ts`（エディタを
  知らない純粋なクラス）にあり、controller がエディタの本文を渡す。

- `features/editor` は、外から CodeMirror の拡張を受け取れるようにだけしておく。
  ツリーを知らない。
- `features/tree` は、CodeMirror の拡張を返す関数を公開する。エディタの React
  コンポーネントを知らない。

## 使っているライブラリ

入れたら、入れた理由をこの表に残す。

| 領域 | ライブラリ | 理由 |
| --- | --- | --- |
| エディタ | `@codemirror/state` `@codemirror/view` `@codemirror/commands` `@codemirror/language` `@codemirror/lang-markdown` `@lezer/highlight` | 1 本の文書と 1 本の履歴を持てる、Vim の拡張がある |
| Vim | `@replit/codemirror-vim` | CodeMirror 6 で唯一まとまった Vim。`defineEx` `defineAction` で `:w` `:e` `za` を足す |
| コマンドパレット、クイックスイッチャー | `cmdk` | キーで選べるリストの振る舞い（上下・絞り込み・読み上げ）をそろえて持っている |
| 状態 | `zustand` | React の外（CodeMirror の拡張、キーの振り分け）からも読み書きできる |
| 検証 | `zod` | Rust から来た値とアプリの状態の JSON を、型と一緒に確かめる |
| Tauri | `@tauri-apps/api` `@tauri-apps/plugin-dialog` | IPC とイベント、保管庫を選ぶダイアログ |
| Rust | `notify`（監視、macOS では FSEvents） `trash`（ゴミ箱） `thiserror` `serde` `blake3`（ハッシュ） `tauri-plugin-dialog` / 開発用に `tempfile` | |
