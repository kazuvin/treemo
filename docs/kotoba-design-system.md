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
   例外は本文の上に出すメモの名前（`text-title`、20px）だけ。

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
| 検索の当たり            | `search-match`                   | `#FFFF0054`           | `--color-search-match`                |

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

**書体は設定で選び直せる**（設定画面の「テーマ」の書体）。候補は `src/lib/font-family.ts` の
`FONT_FAMILIES` で、上の Noto の組が既定。ほかに SF Mono・Menlo（等幅）、Noto Sans JP・
ヒラギノ角ゴ・ヒラギノ明朝（プロポーショナル）を置く。同梱しない書体は macOS に入っているものを
名前で指す。`applyFontFamily` が `<html>` の style で `--font-sans` と `--font-mono` を**同じ値に**
上書きするので、「1 つの書体に寄せる」ことは書体を変えても崩れない。書体は色のプリセットには
属さない（どのテーマでも同じ）。既定の値を変えたら `globals.css` も直す
（`src/lib/font-family.test.ts` が食い違いを見つける）。

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
| `text-title`  | `1.25rem`   | 20  | 1.75rem  | -0.015em | メモの名前 (本文の上) だけ    |
| `text-mark`   | `2rem`      | 32  | 1        | -0.025em | 文字組みの外 (下記)           |

- **どの段も `--font-scale` を掛ける。** 設定の「文字の大きさ」(`text-base` の px、既定 14) を
  14 で割った値で、`src/lib/font-size.ts` の `applyFontSize` が `<html>` の style に書く。
  上の px は倍率 1 のとき。`html` の基準を振らないのは上の理由のとおりで、動くのは
  `--text-*` とその line-height だけ。余白は変えない。

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
例外は重ねる箱（`OverlayPanel`）の出入りだけで、上から 4px・98% の大きさからフェードで
現れ（160ms）、同じ形で消える（120ms）。どこから出てどこへ消えたかを見せるため。
押下は暗い塗りへの差し替えであって、縮小でもフェードでもない。
意味の開示はアニメーションではなく即時のレイアウト変更 — 学習者は読んでいる最中で、
文字の下で動きが起きるのはコストだから。

例外はツリーブロックだけで、形が変わったときにノードの位置を滑らせる
（[tree-block.md](tree-block.md) の「動き」）。

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

### `Select`

値を 1 つ選ぶ箱 (`src/components/ui/select.tsx`)。開くかどうかは親が持つ (`open` /
`onOpenChange`)。設定画面では項目の上で `Enter` を押すと開き、開いた一覧がキーを受ける。

```tsx
<Select label="書体" options={options} value={value} onChange={set} open={open} onOpenChange={setOpen} />
```

- 箱は `border-border-strong` の 1px と `bg-background`。一覧は `bg-popover` に同じ線で、
  **影は使わない**。カーソルの行は `bg-selected`、今の値は `font-semibold`。
- 一覧は `j` / `k` (`↑` / `↓`)、`g` / `G` で動き、`Enter` / `Space` で決め、`Esc` / `q` / `h`
  でやめる。開いている間はほかのキーを外へ漏らさない。フォーカスが外れたら閉じる。
- 選択肢の `style` は一覧の中でだけ効く (書体の見本を、その書体で出すのに使う)。

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
  `Button`（上の節と同じ 2 層の DOM）、`Kbd`（キーの表記）、`Code`（本文の中のコード `hoge` の見た目。大きさと色は周りに合わせる）、`KeyHints`（`Code` でキーを示す控えめな案内の 1 行）、`OverlayPanel`（パレットや
  ダイアログを重ねる箱。影は使わず 1px の線で分ける）、`PromptDialog`（名前の入力と削除の確認）。
  `Text` / `Toast` / `Screen` はまだ無い。消えて困る知らせはトーストにしない決まりなので、
  `Toast` は要るまで入れない。
- **`OverlayPanel` を閉じるときは `usePresence` を通す。** 閉じてからアニメーションが
  終わるまで出し続け、そのあいだ `closing` を渡して退場させる（`src/components/ui/use-presence.ts`）。
- **フォーカスリングは `@layer base` に置く。** キーを受けるだけの領域（`tabIndex` を持つ
  `div`。サイドバーや設定画面の一覧）は `outline-none` でリングを消し、別の形（上端の線、
  行の選択色）でフォーカスを示す。
- **コマンドパレットとクイックスイッチャーは `cmdk` で新しく書いた。** kazuvin.me の
  `command.tsx` は移植していない。見た目は `OverlayPanel` と同じ面・線・選択色にそろえてある
  （`features/commands/components/command-palette.tsx`）。
- **選択状態は枠線とティントの 2 つで示す。** サイドバーの行とツリーのノードは、選んでいるものに
  アクセントの枠線（行は左端の線）とティントを付ける。`✓` はチェックボックスだけに使う。
- **フォントは Fontsource をそのまま読む。** kazuvin.me は欧文を `next/font` で配信していたが、
  ここは Vite なので `src/main.tsx` で `@fontsource-variable/*` を読み、`globals.css` の
  `--font-sans` / `--font-mono` は書体名を直接指す。
- **14px の上限はエディタにも効く。** メモの見出しも大きさでは段を付けず、太さ・色・余白で
  区別する（[要件定義](requirements.md) の F-EDIT-2）。本文の上のメモの名前（F-EDIT-6）だけは
  Obsidian や Notion に合わせて `text-title` で大きく出す。長文を等幅書体で書くことになるので、
  使ってみて読みにくければ、この制約ごと見直す。
- **アクセント色は TREE モードの枠にも使う。** 「今キー入力を受け取っている場所」を示す
  フォーカスの一種として扱う（[キー操作](keybindings.md) の「モード」）。
- **`src/lib/cn.ts` は kazuvin.me と同じ。** `text-2xs` と `text-mark`（と Treemo で足した `text-title`）を `font-size` として
  登録している理由はそちらの経緯のまま。回帰テストは `src/lib/cn.test.ts`。

## テーマ

色のトークン（`--color-*`）はテーマで差し替えられる。組み込みのプリセットは Kotoba（既定）、
Kotoba Dark、Washi と、背景画像を敷く山・川・海・森・夜・焚き火・雨の 10 個で、ユーザーはそれを元にした
カスタムのプリセットを作れる。

- **変えるのは意味のトークン、選ぶのはパレットの段。** 設定画面は意味のトークン（面・文字・
  境界・選択など）を先に並べ、値はパレット（ランプ 11 段とアクセント 4 段）から選ぶのを
  基本にする。色を直に書くこともできるが、パレットから選べばテーマの中の色が散らばらない。
- **トークンの値は色か、別のトークンの名前。** `#rrggbb` なら色そのもの、`gray-900` のような
  名前ならそのトークンを指す（CSS では `var(--color-gray-900)`）。プリセットの意味の
  トークン（面・文字・境界・選択など）はどれもランプとアクセントの段を指すので、プリセットの
  違いはランプとアクセントの 15 段だけ。輪になって色へ辿れなくなる値は受け付けない。
- **プリセットは `src/lib/theme.ts` の `THEMES` に書く。** 書体・余白・角丸はテーマで
  変えない（書体は設定で別に選ぶ）。「壊してはいけない 3 つの制約」はどのテーマでも守る（アクセントは
  フォーカスと選択にだけ使う、プライマリの面はランプの 900）。
- **`globals.css` の `@theme` にも Kotoba の値を書く。** Tailwind がユーティリティを作るのと、
  起動して状態を読むまでの最初の描画に使う。Kotoba の値を変えたら両方を直す
  （`src/lib/theme.test.ts` が食い違いを見つける）。
- **背景の写真はぼかしてウィンドウの後ろに敷き、本文はその上に直に置く。** 見た目は
  Neovim の書き物向けプラグイン（zen-mode.nvim など）を、ぼかした壁紙と透過した端末で
  使うときに寄せている。写真を持つプリセット（`Backdrop`）は、`applyTheme` が
  `--backdrop-image`・`--backdrop-blur`・`--backdrop-veil`・`--backdrop-paper` を書く。
  app が画面の一番後ろに写真を `blur` の px でぼかして置き（縁が透けないよう画面より
  大きく敷く）、その上に background の色を `veil` の濃さで重ねる。エディタ自身は
  背景を持たないので、本文は写真の上に直に乗る。サイドバーとステータスバーにだけ
  `paper` の濃さで重ね、本文と区切る。写真を持たないプリセットでは 4 つとも空になり、
  見た目は変わらない。
- **写真の明るさで color-scheme を決める。** 黒に近い写真（夜・焚き火・雨）は Dark の
  プリセットにし、文字を白系（ランプの 900 が明るい色）にする。明るい写真（山・川・海・森）は
  Light。写真を足すときは 64×43 に縮めたグレースケールの平均（0〜255）を測り、おおよそ
  90 を下回れば Dark にする（今の写真は 山 147・川 108・海 170・森 95・夜 56・焚き火 38・雨 78）。
  ぼかすと細かいもの（星や蛍の光）は消えるので、色と明暗の大きな塊で選ぶ。
- **写真は Unsplash から取った。** [Unsplash License](https://unsplash.com/license)
  （商用も含めて無料で使え、クレジットも要らない）のもので、Unsplash+ の写真は使わない。
  1600×1067・JPEG で `src/assets/backdrops/` に置いている。ぼかして使うので、これより大きくしない。

  | ファイル | 写真 | 撮影 |
  | --- | --- | --- |
  | `yama.jpg` | [雲海と朝焼けの山並み](https://unsplash.com/photos/ic_ED5M5evg) | Yevhenii Deshko |
  | `kawa.jpg` | [新緑の森を流れる渓流](https://unsplash.com/photos/3GkCCtlxt0w) | Eugene |
  | `umi.jpg` | [砂浜に寄せる波と水平線](https://unsplash.com/photos/ICQLkj8zMeU) | Robert Woeger |
  | `mori.jpg` | [木漏れ日の苔むした森](https://unsplash.com/photos/xXbaTOP31M4) | Caspian Dahlström |
  | `yoru.jpg` | [星の軌跡と蛍の夜](https://unsplash.com/photos/s6wdwpZCtkk) | Mike Lewinski |
  | `takibi.jpg` | [夜の焚き火](https://unsplash.com/photos/TRys9NU8GiQ) | Luke Porter |
  | `ame.jpg` | [夜の窓の雨粒と街の灯](https://unsplash.com/photos/1e60bqR1Ar0) | Max van den Oetelaar |
- **カスタムは「元にした組み込みのプリセット + 変えたトークン」。** 組み込みのプリセットは
  変えられず、そこで色を変えると写したカスタムができる。color-scheme と、`r` で戻す先は
  元のプリセットから取る。
- **選んでいるテーマとカスタムは状態として持つ。** `src/stores/theme-store.ts` が持ち、
  `src/app/app.tsx` が購読して `applyTheme` で `<html>` の `data-theme`・`color-scheme`・
  すべての色の変数を書き、アプリの状態（`theme` と `customThemes`）に保存する。
  保存したカスタムに読めないトークンがあればそこだけ捨て、元のプリセットが無い・トークンが
  輪になっているカスタムは丸ごと捨てる。選んでいた ID が無ければ既定に戻す。
- **変えるのは設定画面の「テーマ」。** 組み込みのプリセットへの切り替えはコマンドにも
  なっている（`app.theme.<id>`、パレットの「テーマ: <名前>」）。キーは割り当てていない。

プリセットを足すときは、`THEMES` に `{ id, label, colorScheme, backdrop, ambience, tokens: preset({ … }) }`
を足し、ランプ 11 段とアクセント 4 段の色を書く。写真を敷くなら `backdrop` に写真と
`LIGHT_BACKDROP` / `DARK_BACKDROP`（ぼかしと濃さ）を、敷かないなら `null` を書く。
`ambience` には写真に合わせた BGM（下の「BGM」）の ID を、無ければ `null` を書く。

### BGM

書いているあいだ、テーマの写真に合わせた環境音を流せる（しずかなインターネットの「ムード」に
倣った）。焚き火の写真なら焚き火の音、雨の窓なら雨の音。

- **音は `src/lib/ambience.ts` の `AMBIENCES` に書く。** プリセットは `ambience` で音を指し、
  カスタムは元のプリセットの音を使う。設定の「BGM」は 流さない（既定）/ テーマに合わせる /
  音を決める から選ぶ。テーマに合わせても、音の無いテーマ（Kotoba など）では流さない。
- **流すのは `src/lib/ambience-player.ts`。** Web Audio でデコードして流す。MP3 は頭と尻に
  無音が入り、そのまま繰り返すと境目で途切れるので、終わりの 4 秒を次の頭と等パワーで重ねて
  つなぐ。音やテーマを替えると 1.5 秒で入れ替わる。音量は設定の % を 2 乗して掛ける。
  WebView は操作を受けるまで音を出させないので、起動して最初のキーかクリックで鳴り始める。
- **音は Freesound の CC0 のものを使う。** 60〜80 秒を切り出し、ラウドネスを -20 LUFS に揃え、
  112kbps の MP3 で `src/assets/ambience/` に置いている。切り出すのは、1 秒ごとの音量の山が
  いちばん小さい区間（急に大きな音が入らないところ）。

  | ファイル | 音 | 録音 |
  | --- | --- | --- |
  | `yama.mp3` | [山頂の茂みを渡る風](https://freesound.org/people/felix.blume/sounds/135193/) | felix.blume |
  | `kawa.mp3` | [穏やかな渓流](https://freesound.org/people/INNORECORDS/sounds/469009/) | INNORECORDS |
  | `umi.mp3` | [凪の波打ち際](https://freesound.org/people/craiggroshek/sounds/176617/) | craiggroshek |
  | `mori.mp3` | [春の午後の森](https://freesound.org/people/bajko/sounds/385280/) | bajko |
  | `yoru.mp3` | [夏の夜の虫](https://freesound.org/people/hdfreema/sounds/333221/) | hdfreema |
  | `takibi.mp3` | [焚き火](https://freesound.org/people/Spandau/sounds/40699/) | Spandau |
  | `ame.mp3` | [窓に打ちつける雨](https://freesound.org/people/bastipictures/sounds/243781/) | bastipictures |
