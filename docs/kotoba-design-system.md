# Kotoba Design System

言語学習モバイルアプリ (React Native) 向けのデザインシステム。
claude.ai/design のプロジェクト **"Kotoba Design System"** からこのリポジトリに取り込んだもの。

- 出典: https://claude.ai/design/p/92cf75bb-e4dd-49ec-aca3-9b5bdb437b3c
- _Kotoba_ (ことば) は**プレースホルダ名**。ブランド・ロゴ・Figma ファイルは未提供で、
  すべて 1 通のブリーフから導出されている。実名が決まったらリネームする。

トークン層は `src/styles/globals.css` にある。この文書とトークン層は kazuvin.me から
そのまま持ってきたもので、Treemo での扱いは末尾の「Treemo での扱い」にある。

---

## 壊してはいけない 3 つの制約

この 3 つは事故で壊しやすく、壊すとデザインシステムとして成立しなくなる。

1. **プライマリアクションの面は黒** (`--color-gray-900`)。アクセントカラーではない。
2. **アクセント (`rgb(242,49,130)` — ロゴのピンク) はフォーカスリングと選択状態にのみ使う。**
   塗り・ステータス・装飾には一切使わない。1 画面あたりの塗り面積は「線」の量に収まる。
3. **文字は `0.875rem` (14px) より大きくしない。** 見出しも本文もこの 1 サイズで、
   階層は太さ・色・余白で作る。上の段を足したくなったら、まず余白を疑う。

赤いエラー・緑の成功といった**セマンティックカラーは存在しない**。
ブリーフが色によるステータス表現を禁じているため、失敗状態は「言葉と位置」で表す。
状態を色だけで伝えることはしない (選択状態は 枠線 + ティント + `✓` の 3 つで冗長化されている)。

---

## トークン表

### semanticColor

ニュートラルランプ 11 段がすべての面・境界・テキスト、**そしてプライマリアクションの塗り**を担う。
色相は 1 つだけ。

| 役割                    | Tailwind キー                    | 値                    | 元トークン                            |
| ----------------------- | -------------------------------- | --------------------- | ------------------------------------- |
| 画面背景                | `background`                     | `#FFFFFF`             | `--color-bg-screen`                   |
| 本文テキスト            | `foreground`                     | `#16161A`             | `--color-text-primary`                |
| カード面                | `card` / `popover`               | `#FFFFFF`             | `--color-bg-raised`                   |
| 唯一のティント          | `muted` / `subtle`               | `#F4F4F6`             | `--color-bg-subtle`                   |
| 二次テキスト            | `subtle-foreground`              | `#56565E`             | `--color-text-secondary`              |
| 三次テキスト            | `muted-foreground`               | `#74747C`             | `--color-text-tertiary`               |
| 反転面                  | `inverse` / `inverse-foreground` | `#16161A` / `#FFFFFF` | `--color-bg-inverse`                  |
| **プライマリ塗り (黒)** | `primary`                        | `#16161A`             | `--color-action-primary-bg`           |
| プライマリラベル        | `primary-foreground`             | `#FFFFFF`             | `--color-action-primary-label`        |
| プライマリ押下          | `primary-pressed`                | `#2C2C31`             | `--color-action-primary-bg-pressed`   |
| セカンダリ面            | `secondary`                      | `#F4F4F6`             | `--color-action-secondary-bg-pressed` |
| ヘアライン              | `border-hairline`                | `#EBEBEE`             | `--color-border-hairline`             |
| 標準境界                | `border`                         | `#DEDEE3`             | `--color-border-default`              |
| 強い境界                | `border-strong` / `input`        | `#C3C3CB`             | `--color-border-strong`               |
| 無効面                  | `disabled`                       | `#EBEBEE`             | `--color-action-disabled-bg`          |
| 無効ラベル              | `disabled-foreground`            | `#9A9AA3`             | `--color-action-disabled-label`       |
| **アクセント**          | `accent`                         | `rgb(242,49,130)`     | `--accent-500`                        |
| フォーカスリング        | `ring`                           | = `accent`            | `--color-focus-ring`                  |
| 選択ティント            | `selected`                       | `#FEEFF5`             | `--color-selected-bg`                 |
| 選択枠線                | `selected-border`                | = `accent`            | `--color-selected-border`             |

ニュートラルランプは `gray-0 / 25 / 50 / 100 / 200 / 300 / 400 / 500 / 600 / 800 / 900` の 11 段。
Tailwind 標準の `gray` は `--color-gray-*: initial` で消してあるので、`gray-700` や `gray-950`
といった**システム外の灰色は書いても効かない**。

**エレベーションは存在しない。** 影のシステムはなく、分離は 1px のヘアラインか余白で行う。
透過・ブラーも使わない (薄い文字はアルファではなく濃いグレーの不透明で表現し、コントラストを計測可能に保つ)。

### typography

**本文も見出しもコードも等幅で組む。** 欧文は `Noto Sans Mono`、和文は `Noto Sans JP`。
同じ Noto なので骨格もウェイトの刻みも揃っていて、和欧が混ざる行でも濃度が破綻しない。
`--font-sans` と `--font-mono` は同じ値を指す。役割としての 2 つは残してあるが、
実体は 1 つの等幅書体に寄せてある。

実体は `@fontsource-variable/*` で self-host し、`src/main.tsx` で両方の CSS を読む。
アプリの中から読むだけなので、Web サイトのような配信の工夫（preload、サブセットの絞り込み）は
要らない。Fontsource は可変フォントを `"Noto Sans Mono Variable"` のような別名で登録するため、
`--font-sans` / `--font-mono` はその名前を直接指す。

#### 基準サイズとスケール

**基準にして上限が `0.875rem` (14px)。** 見出しも本文も同じ 14px で組み、階層は
**太さ・色・余白**だけで作る。サイズを上に伸ばして段を作らない。
Linear や Vercel のダッシュボードが 13〜14px の 1 サイズにほぼ全部を寄せているのと同じ考え方で、
等幅 1 書体で通しているこのアプリとは特に相性がいい
(サイズを変えても字面の濃度が変わらない等幅では、大きさより太さのほうが段として読みやすい)。

rem の基準 (`html`) は **16px のまま触らない**。`html` を 87.5% に振って「1rem = 14px」に
する手もあるが、Radix / Shiki / Fontsource などこちらが書いていない rem までまとめて動くうえ、
ユーザーのブラウザ既定サイズと二重にかかるので採らない。1rem = 16px を基準に、
スケールは **rem で相対的に**定義する。px 直書きと違って、ユーザーがブラウザの既定文字サイズを
上げれば全段が比例して伸びる。

`body` にも font-size を敷かない。ここは rem の基準を 16px に保つ層で、実際に描かれる
テキストのサイズは**レイアウトシェル**が与える。本文 (`page-shell.tsx` の `<main>`) が
`text-base`、左右のレールは行が `text-sm`。レールはページの付属なので、本文より 1 段
下げて揃える (左は `<aside>` から継がせ、右は `em` を 13px に固定する都合で行ごとに敷く)。

| Tailwind キー | rem         | px  | line     | tracking | 用途                          |
| ------------- | ----------- | --- | -------- | -------- | ----------------------------- |
| `text-2xs`    | `0.6875rem` | 11  | 1rem     | 0.04em   | overline                      |
| `text-xs`     | `0.75rem`   | 12  | 1rem     | 0.02em   | ラベル・チップ・メタデータ    |
| `text-sm`     | `0.8125rem` | 13  | 1.25rem  | 0        | キャプション・コード・表・レール |
| **`text-base`** | **`0.875rem`** | **14** | **1.25rem** | **0** | **基準。本文も見出しもここ** |
| `text-mark`   | `2rem`      | 32  | 1        | -0.025em | 文字組みの外 (下記)           |

- 梯子は 11 / 12 / 13 / 14 の **4 段だけ**で、上に伸びる段は持たない。
- Tailwind 既定のスケールは `--text-*: initial` で消してある。`text-lg` や `text-2xl` は
  **書いても効かない** (ニュートラルランプと同じ方針)。キー名は Tailwind 既定に揃えてあるので、
  既存の `text-sm` / `text-xs` はそのままこのスケールに乗る。
- line-height は 4px グリッドに着地する rem。長文だけ `leading-relaxed` (1.75) で開ける。
- letter-spacing は em なので、どの段でも比率が保たれる。小さい段ほど開く
  (等幅の 11〜12px は詰まると潰れる)。

`text-mark` (32px) は**文字組みの外側**。絵文字や数字を「文字」ではなく「絵」として置く
逃がし口で、テキストの段ではない (だから `2xs…base` の梯子に連なる名前を付けていない)。
現状の使用箇所はトップの ☕️ と 404 の数字の 2 つだけで、**コピーには使わない。**

#### font-weight

**サイズに束ねない。** このシステムでは太さが階層そのものなので、`text-*` と `font-*` は
必ず直交させる。出荷する太さは 4 段で、既定を消してあるので `font-light` / `font-black` は効かない。

| Tailwind キー   | 値  | 用途                       |
| --------------- | --- | -------------------------- |
| `font-normal`   | 400 | 本文                       |
| `font-medium`   | 500 | ラベル・ボタン             |
| `font-semibold` | 600 | 見出し (h2 相当以下)       |
| `font-bold`     | 700 | ページタイトル (h1 相当)   |

#### role

8 つの role が `Text` から使える。どれもスケールの上に乗っていて、独自のサイズは持たない。
**上の 5 つはすべて同じ 14px** で、段を作っているのは太さと色だけ。サイズが落ちるのは、
本文ではないメタデータ (`caption` / `label` / `overline`) に入ってからだけ。

| role         | size          | weight | 色                 | 既定タグ |
| ------------ | ------------- | ------ | ------------------ | -------- |
| `title`      | `base` (14)   | 700    | `foreground`       | `h1`     |
| `heading`    | `base` (14)   | 600    | `foreground`       | `h2`     |
| `subheading` | `base` (14)   | 600    | `subtle-foreground`| `h3`     |
| `body`       | `base` (14)   | 400    | `foreground`       | `p`      |
| `lead`       | `base` (14)   | 400    | `subtle-foreground`| `p`      |
| `caption`    | `sm` (13)     | 400    | `subtle-foreground`| `p`      |
| `label`      | `xs` (12)     | 500    | `foreground`       | `span`   |
| `overline`   | `2xs` (11)    | 600    | `muted-foreground` | `p`      |

- 密度もサイズを削って作らない。詰めたいときは**余白のほう**を詰める。
- 大文字は `overline` のみ。それ以外はボタンを含めすべてセンテンスケース。
- 記事本文 (`.note-content`) も同じ 14px。h1〜h4 は太さ (700 → 600 → 600 → 500)、色、
  そして直上の余白の 3 つで段を付ける。サイズ差が無いぶん余白の差は大きめに取ってある。


### spacing

基本単位 **4px**。出荷される値はすべて `4 × n`。

| tier | 用途                             | Tailwind キー | px  |
| ---- | -------------------------------- | ------------- | --- |
| 1    | 画面端 (左右)                    | `edge-h`      | 24  |
| 1    | 画面端 (上)                      | `edge-top`    | 56  |
| 1    | 画面端 (下)                      | `edge-bottom` | 48  |
| 2    | ブロック間                       | `block`       | 32  |
| 2    | アクション群の前                 | `block-loose` | 48  |
| 2    | 1 つの考えの 2 行                | `block-tight` | 20  |
| 3    | コントロール内 padding x         | `inset-x`     | 20  |
| 3    | コントロール内 padding y         | `inset-y`     | 12  |
| 3    | アイコン↔ラベル、ボタン↔ボタン | `gap`         | 8   |
| 3    | バッジオフセット                 | `gap-tight`   | 4   |

**tier の順序は軸ごとに読む**: 左右の画面端 (24) < ブロック間 (32) < 上下の画面端 (48 / 56)。
要素内 (≤20) が一番小さいのは軸によらない。左右を詰めるのは読み幅がもともと狭く、
ガターを広げたぶんがそのまま行長から引かれるため。上下を開けるのは、ヘッダーを持たない
kazuvin.me ではページの上端が兄弟要素ではなくブラウザの UI と接するため。
上の値だけが許可された値で、それ以外は使わない。

- tier 1 は `Screen` の専有。他のどこでも画面端 padding を宣言しない。
- tier 2 は兄弟要素間のスペーサー。
- tier 3 はコンポーネントの内側にあり、margin として外に漏れない。

タップ形状 — **視覚的な箱とタップ領域は別トークン**。ラベルサイズを変えても箱は動かない。

| キー         | px  | 用途                               |
| ------------ | --- | ---------------------------------- |
| `tap-min`    | 44  | 最小タップ領域                     |
| `control`    | 40  | 既定ボタンの視覚高                 |
| `control-lg` | 52  | large ボタンの視覚高               |
| `hitslop`    | 2   | 40 の箱を 44 に広げる透明帯 (上下) |

### radius

| キー             | px  | 用途                                  |
| ---------------- | --- | ------------------------------------- |
| `control` (`md`) | 12  | ボタン等のコントロール                |
| `card` (`lg`)    | 16  | カード                                |
| `focus`          | 14  | フォーカスリング (control + offset 2) |
| `chip`           | 999 | ピル                                  |
| `sm`             | 8   | —                                     |

これ以外の値は使わない。

### motion

120ms / `cubic-bezier(0.2, 0, 0.2, 1)` (`ease-standard`)、**color と opacity のみ**。
バウンス・スプリング・スケールイン・ページトランジションは無い。
押下は暗い塗りへの差し替えであって、縮小でもフェードでもない。
意味の開示はアニメーションではなく即時のレイアウト変更 — 学習者は読んでいる最中で、
文字の下で動きが起きるのはコストだから。

---

## コンポーネント

### `Button`

画面のアクションコントロール。**1 画面に primary は 1 つ**、他はすべて secondary。

```tsx
<Button variant="primary" size="large" fullWidth onClick={reveal}>Show meaning</Button>
<Button variant="secondary" fullWidth onClick={skip}>Skip for now</Button>
<Button variant="secondary" selected onClick={pick}>Formal register</Button>
```

| prop        | 値                            | 既定      |
| ----------- | ----------------------------- | --------- |
| `variant`   | `primary` / `secondary`       | `primary` |
| `size`      | `default` (40) / `large` (52) | `default` |
| `disabled`  | boolean                       | `false`   |
| `selected`  | boolean (secondary 専用)      | `false`   |
| `fullWidth` | boolean                       | `false`   |

- `size="default"` は 40px の箱を描き、タップ領域を 2px ずつ広げて 44 にする。
  `size="large"` は 52px でスロップ不要。**箱を 40 未満に縮めない。**
- `selected` は必ず `✓` グリフを伴う。状態を色だけで伝えないため。
- `disabled` はグレー塗りに落とすが、**ラベルの文言は変えない** (何をする物か読めるまま残す)。
- **第 3 の variant は無い。** secondary より静かに見せたいものはボタンではなく、
  本文テキスト + リンク。

DOM は 2 層になっている。外側の `<button>` がタップ領域とフォーカスリングを持ち、
内側の `<span>` が視覚的な箱を描く。これが React Native の `hitSlop` の web での対応物。

### `Text`

画面上のすべてのコピー。role が typography トークン一式 (サイズ・太さ・色) を選ぶ。

```tsx
<Text role="overline">Design system</Text>
<Text role="title">Typography</Text>
<Text role="lead">基準にして上限が 0.875rem。</Text>
<Text role="caption">2026-09-06</Text>
```

- サイズ・太さ・色は role が決める。`className` で色を上書きする場合も
  セマンティックキー (`text-muted-foreground` 等) を使い、生の hex は書かない。
- **`className` でサイズを上げない。** 大きく見せたいときは role を上げる
  (= 太さと色が変わる) か、余白を足す。
- `as` で既定タグを上書きできる。見た目の段と HTML の見出しレベルは別物なので、
  h2 の位置に `heading` 以外を置きたいときはここで調整する。

### `Toast`

画面の外で起きたことの告知。実装は `@radix-ui/react-toast` のラップで、右下に積む。

```tsx
useToastStore.getState().notify({
  tone: 'error',
  title: '検索を読み込めませんでした',
  description: '通信を確かめて、開き直してください',
})
```

| prop          | 値                   | 既定     |
| ------------- | -------------------- | -------- |
| `tone`        | `info` / `error`     | `info`   |
| `title`       | string               | (必須)   |
| `description` | string               | なし     |

- **`tone` は見た目を変えない。** このシステムに色分けされたステータスは無いので
  (「壊してはいけない 3 つの制約」)、面も文字色も 2 つで同じ。`tone` が決めるのは
  **読み上げの強さと表示時間**だけ — `error` は `aria-live="assertive"` (Radix の
  `type="foreground"`) で 10 秒、`info` は polite で 5 秒。
- **影は使わない。** 面は `bg-card`、分離は 1px の `border-border`。他のカードと同じ。
- 入場は `fade-slide-up`、退場は `fade-out`。どちらも `motion-safe:` の内側。
- **トーストで状態を代替しない。** 一覧が空である理由のように画面に残るべきことは、
  その場所にインラインで書く。トーストは消えるので、消えて困るものを載せない
  (コマンドパレットの取得失敗が両方を出しているのはこのため)。
- 通知そのものはストア (`src/stores/toast-store.ts`) が持ち、描くのは
  `components/layouts/toaster.tsx`。**Radix のチャンクは最初の通知まで落ちてこない。**

### `Screen`

tier-1 の画面端スペーシング (24 / 32 / 24) を供給するシェル。

```tsx
<Screen>
  <Text role="overline">Unit 4</Text>
  <div className="h-block" />
  <Text role="title" lang="ja">
    お願いできますか
  </Text>
</Screen>
```

`width` は既定 390 (設計時のビューポート幅)。子はシェルと喧嘩する margin を足さない。

---

## コンテンツの書き方

**声**: 二人称・現在形・感嘆符なし。アプリは自分自身ではなく言語の話をする。
読み手は作業の途中で、少し急いでいる学習者。

- ボタンラベルは動詞始まりの 1〜3 語 — "Show meaning" / "Got it" / "Practice again"。
- 補助テキストは仕組みを述べる。気分は述べない。
  ○ "Tap the phrase to hear it again" / ✕ "Great work, keep going!"
- 用法注記は事実ベースで語域を意識する。近い形との比較が標準の型。
  "Softer than 〜してください. Safe with people you have just met."
- **ゲーミフィケーション語彙を使わない** — streak / XP / レベル / 祝辞。"Oops" も "Nice!" も無し。
- **絵文字は使わない。** システム内の非アルファベット記号は選択状態に付く `✓` (U+2713) だけ。
- ケーシングはセンテンスケース (ボタンも)。例外は `overline` のみ。
- 中黒 `·` はメタデータの区切り ("Unit 4 · Requests")。カウンタは裸で空けて "1 / 2"。
  目標言語のテキストはネイティブの約物 (？ 。) をそのまま保つ。

## アイコン

**アイコンセットは無い。** ブリーフの 1 画面には不要だったので作っていない。
使っている唯一のグリフは選択状態の `✓` で、これはアイコンではなくテキスト。

将来必要になったら **Lucide** (24px グリッド / 2px ストローク / ラウンドキャップ) を推奨。
このシステムのヘアライン太さと 12px のコントロール半径に合う。
その際はサイズと色をトークン化したままにするため `Icon` ラッパーを追加すること。

---

## Treemo での扱い

kazuvin.me（Next.js）に取り込んだものを、トークン層と文書ごと持ってきた。

- **コンポーネントは要るものだけを置いている。** `src/components/ui/` にあるのは
  `Button`（上の節と同じ 2 層の DOM）、`Kbd`（キーの表記）、`OverlayPanel`（パレットや
  ダイアログを重ねる箱。影は使わず 1px の線で分ける）、`PromptDialog`（名前の入力と削除の確認）。
  `Text` / `Toast` / `Screen` はまだ無い。消えて困る知らせはトーストにしない決まりなので、
  `Toast` は要るまで入れない。
- **コマンドパレットとクイックスイッチャーは `cmdk` で新しく書いた。** kazuvin.me の
  `command.tsx` は移植していない。見た目は `OverlayPanel` と同じ面・線・選択色にそろえてある
  （`features/commands/components/command-palette.tsx`）。
- **選択状態は枠線とティントの 2 つで示す。** サイドバーの行とツリーのノードは、選んでいるものに
  アクセントの枠線（行は左端の線）とティントを付ける。`✓` はチェックボックスだけに使う。
- **フォントは Fontsource をそのまま読む。** kazuvin.me は欧文を `next/font` で配信していたが、
  ここは Vite なので `src/main.tsx` で `@fontsource-variable/*` を読み、`globals.css` の
  `--font-sans` / `--font-mono` は書体名を直接指す。
- **14px の上限はエディタにも効く。** メモの見出しも大きさでは段を付けず、太さ・色・余白で
  区別する（[要件定義](requirements.md) の F-EDIT-2）。長文を等幅書体で書くことになるので、
  使ってみて読みにくければ、この制約ごと見直す。
- **アクセント色は TREE モードの枠にも使う。** 「今キー入力を受け取っている場所」を示す
  フォーカスの一種として扱う（[キー操作](keybindings.md) の「モード」）。
- **`src/lib/cn.ts` は kazuvin.me と同じ。** `text-2xs` と `text-mark` を `font-size` として
  登録している理由はそちらの経緯のまま。回帰テストは `src/lib/cn.test.ts`。

## テーマ

色のトークンはテーマごとに差し替えられる。今あるのは Kotoba（既定）の 1 つだけ。

- **選んでいるテーマは状態として持つ。** `src/stores/theme-store.ts` が ID を持ち、
  `src/app/app.tsx` が購読して `<html data-theme="<id>">` と `color-scheme` を書き、
  アプリの状態（`src/app/persisted-state.ts` の `theme`）に保存する。
  保存した ID が一覧に無ければ既定に戻す。
- **切り替えはコマンド。** テーマごとに `app.theme.<id>`（パレットの「テーマ: <名前>」）を
  登録する。キーは割り当てていない。
- **色の値は CSS にだけ書く。** `globals.css` の `@theme` にある値が Kotoba のもので、
  Tailwind のユーティリティはこれを `var()` で参照している。別のテーマは
  `:root[data-theme='<id>']` で同じ変数を上書きするので、コンポーネントは書き換えない。

テーマを足すときは次の 2 つをする。

1. `src/lib/theme.ts` の `THEMES` に `{ id, label, colorScheme }` を足す。
2. `src/styles/themes/<id>.css` に `:root[data-theme='<id>'] { … }` を書き、`globals.css` から
   `@import` する。上書きするのは色の変数（ニュートラルランプ・アクセント・セマンティック）
   だけで、書体・余白・角丸はテーマで変えない。「壊してはいけない 3 つの制約」はどのテーマでも守る。
