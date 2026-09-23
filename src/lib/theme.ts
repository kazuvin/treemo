/**
 * テーマ。色のトークンの値をプリセットごとに持ち、ユーザーの上書きを重ねて `<html>` に書く。
 * 考え方と足し方は docs/kotoba-design-system.md の「テーマ」。
 */

/** パレット。意味のトークンが指す段で、プリセットの違いはここだけ */
export const PALETTE_TOKENS = [
  'gray-0',
  'gray-25',
  'gray-50',
  'gray-100',
  'gray-200',
  'gray-300',
  'gray-400',
  'gray-500',
  'gray-600',
  'gray-800',
  'gray-900',
  'accent',
  'accent-600',
  'accent-700',
  'accent-tint',
] as const

/** 意味のトークン。設定画面ではこちらを先に並べ、値はパレットから選ぶ */
export const SEMANTIC_GROUPS = [
  {
    label: '面と文字',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'inverse',
      'inverse-foreground',
      'muted',
      'muted-foreground',
      'subtle',
      'subtle-foreground',
      'secondary',
      'secondary-foreground',
    ],
  },
  {
    label: 'アクション',
    tokens: [
      'primary',
      'primary-foreground',
      'primary-pressed',
      'destructive',
      'destructive-foreground',
    ],
  },
  { label: '境界', tokens: ['border', 'border-hairline', 'border-strong', 'input'] },
  { label: 'フォーカスと選択', tokens: ['ring', 'selected', 'selected-border'] },
  { label: '無効', tokens: ['disabled', 'disabled-foreground'] },
] as const

export const TOKEN_GROUPS = [
  ...SEMANTIC_GROUPS,
  { label: 'パレット', tokens: PALETTE_TOKENS },
] as const

export type ColorToken = (typeof TOKEN_GROUPS)[number]['tokens'][number]

export const COLOR_TOKENS: readonly ColorToken[] = TOKEN_GROUPS.flatMap((g) => g.tokens)

/** `#` で始まれば色、それ以外は別のトークンの名前（そのトークンの値を指す） */
export type TokenValue = string

export type TokenMap = Record<ColorToken, TokenValue>

export type PaletteToken = (typeof PALETTE_TOKENS)[number]

type Ramp = Pick<TokenMap, PaletteToken>

/** 意味のトークンは、どのプリセットでもランプとアクセントの段を指す */
const SEMANTIC: Omit<TokenMap, keyof Ramp> = {
  background: 'gray-0',
  foreground: 'gray-900',
  card: 'gray-0',
  'card-foreground': 'gray-900',
  popover: 'gray-0',
  'popover-foreground': 'gray-900',
  inverse: 'gray-900',
  'inverse-foreground': 'gray-0',
  muted: 'gray-50',
  'muted-foreground': 'gray-500',
  subtle: 'gray-50',
  'subtle-foreground': 'gray-600',
  secondary: 'gray-50',
  'secondary-foreground': 'gray-900',
  primary: 'gray-900',
  'primary-foreground': 'gray-0',
  'primary-pressed': 'gray-800',
  destructive: 'gray-900',
  'destructive-foreground': 'gray-0',
  border: 'gray-200',
  'border-hairline': 'gray-100',
  'border-strong': 'gray-300',
  input: 'gray-300',
  ring: 'accent',
  selected: 'accent-tint',
  'selected-border': 'accent',
  disabled: 'gray-100',
  'disabled-foreground': 'gray-400',
}

function preset(ramp: Ramp): TokenMap {
  return { ...ramp, ...SEMANTIC }
}

export const THEMES = [
  {
    id: 'kotoba',
    label: 'Kotoba',
    colorScheme: 'light',
    // globals.css の @theme と同じ値（theme.test.ts で確かめる）
    tokens: preset({
      'gray-0': '#ffffff',
      'gray-25': '#fafafb',
      'gray-50': '#f4f4f6',
      'gray-100': '#ebebee',
      'gray-200': '#dedee3',
      'gray-300': '#c3c3cb',
      'gray-400': '#9a9aa3',
      'gray-500': '#74747c',
      'gray-600': '#56565e',
      'gray-800': '#2c2c31',
      'gray-900': '#16161a',
      accent: '#f23182',
      'accent-600': '#cb2a6e',
      'accent-700': '#9b2356',
      'accent-tint': '#feeff5',
    }),
  },
  {
    id: 'kotoba-dark',
    label: 'Kotoba Dark',
    colorScheme: 'dark',
    tokens: preset({
      'gray-0': '#16161a',
      'gray-25': '#1b1b20',
      'gray-50': '#212127',
      'gray-100': '#2a2a30',
      'gray-200': '#37373e',
      'gray-300': '#4a4a53',
      'gray-400': '#6c6c75',
      'gray-500': '#8f8f98',
      'gray-600': '#b1b1b9',
      'gray-800': '#dedee3',
      'gray-900': '#f4f4f6',
      accent: '#f5498f',
      'accent-600': '#f7689f',
      'accent-700': '#f98fb9',
      'accent-tint': '#3a1b2a',
    }),
  },
  {
    id: 'washi',
    label: 'Washi',
    colorScheme: 'light',
    tokens: preset({
      'gray-0': '#fdfbf7',
      'gray-25': '#f9f6f0',
      'gray-50': '#f3efe7',
      'gray-100': '#ebe5da',
      'gray-200': '#ddd5c7',
      'gray-300': '#c4baa8',
      'gray-400': '#9d937f',
      'gray-500': '#776e5d',
      'gray-600': '#5a5244',
      'gray-800': '#2f2a22',
      'gray-900': '#1c1813',
      accent: '#2f5da8',
      'accent-600': '#274f8f',
      'accent-700': '#1e3d6f',
      'accent-tint': '#e9eff8',
    }),
  },
] as const satisfies readonly {
  id: string
  label: string
  colorScheme: 'light' | 'dark'
  tokens: TokenMap
}[]

export type BuiltinThemeId = (typeof THEMES)[number]['id']

/** 選んでいるテーマの ID。組み込みの ID か、カスタムの ID */
export type ThemeId = string

export const DEFAULT_THEME: BuiltinThemeId = 'kotoba'

/**
 * ユーザーが作ったプリセット。元にした組み込みのプリセットと、そこから変えたトークンだけを持つ。
 * `r` で戻す先と color-scheme は元のプリセットから取る
 */
export interface CustomTheme {
  id: string
  label: string
  base: BuiltinThemeId
  tokens: Partial<TokenMap>
}

export interface ResolvedTheme {
  id: ThemeId
  label: string
  colorScheme: 'light' | 'dark'
  tokens: TokenMap
  /** 元にした組み込みのプリセット。組み込みならそれ自身 */
  base: (typeof THEMES)[number]
  custom: CustomTheme | null
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isColorToken(name: string): name is ColorToken {
  return (COLOR_TOKENS as readonly string[]).includes(name)
}

export function isHex(value: string): boolean {
  return HEX.test(value)
}

function builtinOf(id: string): (typeof THEMES)[number] | undefined {
  return THEMES.find((t) => t.id === id)
}

/** ID のテーマを組み立てる。無い ID なら既定のテーマ */
export function resolveTheme(id: ThemeId, customs: readonly CustomTheme[]): ResolvedTheme {
  const custom = customs.find((c) => c.id === id)
  if (custom) {
    const base = builtinOf(custom.base) ?? THEMES[0]
    return {
      id: custom.id,
      label: custom.label,
      colorScheme: base.colorScheme,
      tokens: { ...base.tokens, ...custom.tokens },
      base,
      custom,
    }
  }
  const base = builtinOf(id) ?? THEMES[0]
  return { ...base, base, custom: null }
}

/** 値を色まで辿る。辿れない（名前が無い、輪になっている）なら null */
export function resolveToken(tokens: TokenMap, name: ColorToken): string | null {
  const seen = new Set<string>()
  let value: string = name
  while (!HEX.test(value)) {
    if (seen.has(value) || !isColorToken(value)) {
      return null
    }
    seen.add(value)
    value = tokens[value]
  }
  return value.toLowerCase()
}

function resolvesAll(tokens: TokenMap): boolean {
  return COLOR_TOKENS.every((token) => resolveToken(tokens, token) !== null)
}

/**
 * 入力をトークンの値にする。`#` 付きの色か、別のトークンの名前（`--color-` や `var()` は
 * 付けても付けなくてもよい）。使えなければ null
 */
export function parseTokenValue(input: string): TokenValue | null {
  const text = input
    .trim()
    .replace(/^var\((.*)\)$/, '$1')
    .replace(/^--color-/, '')
  if (HEX.test(text)) {
    return text.toLowerCase()
  }
  return isColorToken(text) ? text : null
}

/** トークンを 1 つ変えたときに、輪になって色へ辿れなくならないか */
export function wouldResolve(tokens: TokenMap, name: ColorToken, value: TokenValue): boolean {
  return resolvesAll({ ...tokens, [name]: value })
}

/** 「カスタム」「カスタム 2」…のうち、まだ使っていない名前 */
export function nextCustomLabel(customs: readonly CustomTheme[]): string {
  const labels = new Set(customs.map((c) => c.label))
  for (let n = 1; ; n++) {
    const label = n === 1 ? 'カスタム' : `カスタム ${n}`
    if (!labels.has(label)) {
      return label
    }
  }
}

export function newCustomId(customs: readonly CustomTheme[]): string {
  const ids = new Set(customs.map((c) => c.id))
  for (let n = 1; ; n++) {
    const id = `custom-${n}`
    if (!ids.has(id)) {
      return id
    }
  }
}

/** 今のテーマを写したカスタムを作る */
export function copyTheme(theme: ResolvedTheme, customs: readonly CustomTheme[]): CustomTheme {
  return {
    id: newCustomId(customs),
    label: nextCustomLabel(customs),
    base: theme.base.id,
    tokens: { ...theme.custom?.tokens },
  }
}

/** 保存したカスタムから、読めないものを捨てる。トークンが輪になっていればそのカスタムごと捨てる */
export function sanitizeCustomThemes(raw: readonly unknown[]): CustomTheme[] {
  const result: CustomTheme[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const { id, label, base: baseId, tokens: rawTokens } = item as Record<string, unknown>
    const base = typeof baseId === 'string' ? builtinOf(baseId) : undefined
    if (
      typeof id !== 'string' ||
      typeof label !== 'string' ||
      !base ||
      builtinOf(id) ||
      result.some((c) => c.id === id)
    ) {
      continue
    }
    const entries =
      typeof rawTokens === 'object' && rawTokens !== null
        ? Object.entries(rawTokens).flatMap(([name, input]) => {
            const value = typeof input === 'string' ? parseTokenValue(input) : null
            return isColorToken(name) && value !== null ? [[name, value] as const] : []
          })
        : []
    const tokens: Partial<TokenMap> = Object.fromEntries(entries)
    if (resolvesAll({ ...base.tokens, ...tokens })) {
      result.push({ id, label, base: base.id, tokens })
    }
  }
  return result
}

function cssValue(value: TokenValue): string {
  return HEX.test(value) ? value : `var(--color-${value})`
}

export function applyTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.colorScheme
  for (const name of COLOR_TOKENS) {
    root.style.setProperty(`--color-${name}`, cssValue(theme.tokens[name]))
  }
}
