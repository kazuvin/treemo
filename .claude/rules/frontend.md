---
paths:
  - "src/**/*.{ts,tsx,css}"
  - ".oxlintrc.json"
  - ".oxfmtrc.json"
  - "tools/oxlint-plugin.mjs"
---

# src を触るときのルール

設計上の決めごとは `docs/` にある。**コードを書く前に、作業に対応する文書を読むこと。**

| 作業 | 読むファイル |
| --- | --- |
| ファイルの置き場所を決める、層をまたぐ import を書く | `docs/directory-structure.md` |
| コンポーネントを追加・修正する、命名や import の形で迷う | `docs/coding-standards.md` |
| 色・余白・書体・角丸を決める、UI の部品を足す | `docs/kotoba-design-system.md` |
| エディタ、ツリー、状態の置き場所 | `docs/architecture.md` |
| ツリーブロックの記法、書き戻し、TREE モードの操作 | `docs/tree-block.md` |
| キーの割り当て、モード、手がかりの表示 | `docs/keybindings.md` |
| テストを書く | `docs/testing.md` |

## 書く前に決まっていること

- **依存は `共有層 → features → app / layouts` の一方向**。feature 間の直接 import は禁止。
  エディタにツリーを載せるような合成は `src/app/` で行う。
- **開いているメモの正本は CodeMirror の文書だけ**。本文を React の state やストアに
  複製しない。TREE モードの操作もテキストへのトランザクションとして発行する。
- **ファイルシステムに WebView から触らない**。Rust のコマンドを `features/vault/api/` 経由で呼ぶ。
- **すべての操作はコマンドとして登録する**。キーの割り当てはコマンドの登録に書き、
  パレット・which-key・ツールチップはそこから作る。
- **状態は既定で `useState`**。島をまたいで共有する必要が出てから Zustand に移し、
  ドメインに閉じるなら `features/<domain>/stores/`、またぐなら `src/stores/` に置く。
- **色は `src/styles/globals.css` の `@theme` にあるものだけ**。アクセント色はフォーカスと
  選択状態（TREE モードの枠を含む）にだけ使う。
- **ファイル名はディレクトリ名も含めて kebab-case**。`index.ts` の barrel は置かない。

## 変更後に通すもの

```sh
pnpm lint        # Oxlint + Oxfmt。直すときは pnpm lint:fix
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```
