# ロードマップ

MVP までの実装の順番。1 つのタスクが 1 回の作業セッションで終わる大きさになるよう
分けてある。

## 進め方

- 上から順に進める。後ろのタスクは前のタスクの成果に乗る。
- タスクを始める前に、「読む」に挙げた文書を読む。
- 終わったら完了条件を満たしたことを確かめ、`pnpm ci:check` を通してからコミットする。
  そのうえでこの文書のチェックボックスを付ける。
- 途中で要件や設計を変えたら、コードと同じコミットで該当する文書も直す。

## M0 雛形

- [x] Tauri 2 + Vite + React 19 + Tailwind v4 の骨組み
- [x] Oxlint / Oxfmt / Vitest / lefthook / commitlint / CI
- [x] 要件と設計の文書

## M1 保管庫とコマンド基盤

読む: [保管庫と iCloud](vault.md)、[設計](architecture.md)

- [x] **1-1 コマンド基盤。** `src/lib/command.ts` の型、`features/commands` の登録、
  `src/stores/mode-store.ts`。まだキーを割り当てるだけで、パレットと which-key は M5。
  - 完了条件: 登録したコマンドを `⌘` 系のキーで呼べ、登録と呼び出しに単体テストがある。
- [x] **1-2 Rust の保管庫コマンド。** `vault_open` `vault_list` `note_read` `note_write`
  `note_create` `note_rename` `note_trash`。パスの検査、置き換え保存、`base_hash` の照合。
  - 完了条件: 一時フォルダを使った `cargo test` で、保管庫の外に出るパスを拒むこと、
    ハッシュが合わないと書かないこと、置き換え保存を確かめている。
- [x] **1-3 保管庫を選ぶ画面と、アプリの状態の保存。** F-VAULT-1。
- [x] **1-4 サイドバーのファイル一覧。** F-VAULT-2。キーでの移動を含む。
- [x] **1-5 メモを開いて自動保存する。** F-VAULT-5。エディタはこの時点では CodeMirror の
  最小構成（Vim 無し）でよい。
- [x] **1-6 ファイルの監視と外部変更の取り込み。** F-VAULT-6。
  - 完了条件: 別のエディタで書き換えると反映され、未保存の変更があるときは選ばせる。
- [x] **1-7 クイックスイッチャーとファイル操作。** F-VAULT-3、F-VAULT-4。

## M2 エディタ

読む: [要件定義](requirements.md) の EDIT、[キー操作](keybindings.md)

- [x] **2-1 Vim。** `@replit/codemirror-vim`、モードを `mode-store` に流す、`:w` と `:e`。
- [x] **2-2 ライブプレビューの方式を決める。** 自作と既存拡張を比べ、決めたことを
  [要件定義](requirements.md) の「決まっていないこと」から外す。
- [x] **2-3 ライブプレビュー。** F-EDIT-2。カーソル行だけ生で表示する。
- [x] **2-4 アウトライナー。** F-EDIT-3。折りたたみ、チェックボックス、リスト項目の移動。

## M3 ツリーの表示

読む: [ツリーブロック](tree-block.md)

- [x] **3-1 解析と書き戻し。** `parse` / `serialize`（`features/tree/utils/`）。
  - 完了条件: 記法の例、読めない行、往復の保証を単体テストで確かめている。
- [x] **3-2 レイアウト。** 左から右の tidy tree。純粋な関数として単体テストを書く。
- [x] **3-3 ブロックを絵にする。** CodeMirror のウィジェット。F-TREE-1、F-TREE-8、F-TREE-9。
- [x] **3-4 ブロックの状態。** 外・選択・ソース表示の 3 つ（F-TREE-2 の 1〜3）。

## M4 TREE モード

読む: [ツリーブロック](tree-block.md)、[キー操作](keybindings.md) の TREE モード

- [x] **4-1 TREE モードと移動。** 入り方・出方、`hjkl`、`gg` / `G`、選択の表示。
- [x] **4-2 組み立ての操作。** 追加・字下げ・入れ替え・削除・コピー・貼り付け。
  取り消しの履歴を 1 本にする（F-TREE-6）。
- [x] **4-3 ノード編集。** 小さなエディタ、INSERT の `Enter` / `Tab`（F-TREE-4）。
- [x] **4-4 全画面との切り替え。** F-TREE-5。
- [x] **4-5 空のブロックを差し込む。** F-TREE-7。

## M5 手がかり

読む: [キー操作](keybindings.md) の「手がかり」

- [x] **5-1 ステータスバーとモード表示。** F-UX-4。
- [x] **5-2 コマンドパレット。** kazuvin.me の `command.tsx` を移植。F-UX-1。
  （移植せず `cmdk` で新しく書いた。[Kotoba](kotoba-design-system.md) の「Treemo での扱い」）
- [x] **5-3 which-key。** F-UX-2。
- [x] **5-4 ヒント。** 画面の要素（`<Space>j`）と TREE モードのノード（`f`）。F-UX-3。
- [x] **5-5 次のキーの案内、ツールチップ、キー一覧。** F-UX-5、F-UX-6、F-UX-8。
- [x] **5-6 キーの割り当てを変える。** F-UX-9。`keybindings.json` で上書きする。サイドバーの
  次のキーの案内も足した。
- [x] **5-7 設定画面。** F-UX-10。キーの割り当ての編集、サイドバーの左右、本文の端からの移動。

## M6 仕上げ

- [ ] **6-1 iCloud の実機確認。** 2 台で衝突を起こす、ダウンロードされていないファイルを
  開く。結果を [保管庫と iCloud](vault.md) に書き、衝突の見つけ方を決める。F-VAULT-7。
- [x] **6-2 速さの確認。** 要件定義の非機能要件の数字を測る。
  - 2026-09-23、本番ビルドの WebView 部分を Chrome で測った（Tauri の IPC はモック）。
    数字は JS の同期処理の時間で、描画（ペイント）は含まない。
  - 1 万行のメモで 1 文字の入力（トランザクション 1 回）: 中央値 2.3ms、最大 9.8ms。
  - 215 ノードのツリーで TREE モードの 1 操作: 移動 3〜8ms、入れ替え・字下げ・取り消し 4〜8ms、
    `o`（ノード編集のエディタを作る）17ms。
  - 起動から最後のメモを編集できるまでの時間は、実機（`.app`）で測っていない。
- [ ] **6-3 アイコンとアプリの名前。** `src-tauri/icons/` は `tauri init` の仮のまま。
- [ ] **6-4 自分用のビルド。** `pnpm build` で `.app` を作り、普段使いに移る。
  - `pnpm tauri build --bundles app` で `Treemo.app` が作れることは確かめた。普段使いに移るのは
    まだ（実機での起動時間の計測もここで行う）。

## M7 プロパティとタグ

MVP の外で足したもの。読む: [要件定義](requirements.md) の F-EDIT-5・F-EDIT-6・F-VAULT-8、
[保管庫と iCloud](vault.md) の「フロントマターを集める」

- [x] **7-1 フロントマターの表。** F-EDIT-5。`features/editor/extensions/front-matter.ts`。
- [x] **7-2 タグ検索。** F-VAULT-8。Rust の `vault_front_matters` とタグの一覧。
- [x] **7-3 本文の上のタイトル。** F-EDIT-6。`features/editor/extensions/note-title.ts`。
