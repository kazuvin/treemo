/**
 * テーマ。色のトークンの値をプリセットごとに持ち、ユーザーの上書きを重ねて `<html>` に書く。
 * 考え方と足し方は docs/kotoba-design-system.md の「テーマ」。
 */
import ame from '@/assets/backdrops/ame.jpg'
import kawa from '@/assets/backdrops/kawa.jpg'
import mori from '@/assets/backdrops/mori.jpg'
import takibi from '@/assets/backdrops/takibi.jpg'
import umi from '@/assets/backdrops/umi.jpg'
import yama from '@/assets/backdrops/yama.jpg'
import yoru from '@/assets/backdrops/yoru.jpg'
import type { AmbienceId } from './ambience'

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

/**
 * ウィンドウの後ろに敷く写真。blur の px でぼかし、その上に background の色を veil の濃さで
 * 重ねる。本文はその上に直に置き、サイドバーとステータスバーにだけ paper の濃さで重ねて区切る
 */
export interface Backdrop {
  image: string
  blur: number
  veil: number
  paper: number
}

const LIGHT_BACKDROP = { blur: 28, veil: 0.55, paper: 0.45 }
const DARK_BACKDROP = { blur: 28, veil: 0.4, paper: 0.45 }

export const THEMES = [
  {
    id: 'kotoba',
    label: 'Kotoba',
    colorScheme: 'light',
    backdrop: null,
    ambience: null,
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
    backdrop: null,
    ambience: null,
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
    backdrop: null,
    ambience: null,
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
  {
    id: 'yama',
    label: '山',
    colorScheme: 'light',
    backdrop: { image: yama, ...LIGHT_BACKDROP },
    ambience: 'yama',
    tokens: preset({
      'gray-0': '#fbfbfd',
      'gray-25': '#f6f7fa',
      'gray-50': '#eff1f5',
      'gray-100': '#e5e8ee',
      'gray-200': '#d6dae3',
      'gray-300': '#bcc2cf',
      'gray-400': '#939aab',
      'gray-500': '#6d7486',
      'gray-600': '#515768',
      'gray-800': '#2a2e3a',
      'gray-900': '#161922',
      accent: '#c8553d',
      'accent-600': '#a94631',
      'accent-700': '#843626',
      'accent-tint': '#f9ebe7',
    }),
  },
  {
    id: 'kawa',
    label: '川',
    colorScheme: 'light',
    backdrop: { image: kawa, ...LIGHT_BACKDROP },
    ambience: 'kawa',
    tokens: preset({
      'gray-0': '#fbfcfa',
      'gray-25': '#f5f8f4',
      'gray-50': '#eef3ec',
      'gray-100': '#e3eae0',
      'gray-200': '#d2dccd',
      'gray-300': '#b6c4b0',
      'gray-400': '#8d9d88',
      'gray-500': '#687764',
      'gray-600': '#4d5a4a',
      'gray-800': '#283026',
      'gray-900': '#151a14',
      accent: '#2a8190',
      'accent-600': '#226b77',
      'accent-700': '#1a535c',
      'accent-tint': '#e6f2f3',
    }),
  },
  {
    id: 'umi',
    label: '海',
    colorScheme: 'light',
    backdrop: { image: umi, ...LIGHT_BACKDROP },
    ambience: 'umi',
    tokens: preset({
      'gray-0': '#fbfcfe',
      'gray-25': '#f5f8fb',
      'gray-50': '#edf2f7',
      'gray-100': '#e1e8f0',
      'gray-200': '#cfd9e4',
      'gray-300': '#b1bfcf',
      'gray-400': '#8898ab',
      'gray-500': '#637386',
      'gray-600': '#485668',
      'gray-800': '#232d3a',
      'gray-900': '#121821',
      accent: '#1f6fb2',
      'accent-600': '#1a5d95',
      'accent-700': '#144874',
      'accent-tint': '#e7f0f8',
    }),
  },
  {
    id: 'mori',
    label: '森',
    colorScheme: 'light',
    backdrop: { image: mori, ...LIGHT_BACKDROP },
    ambience: 'mori',
    tokens: preset({
      'gray-0': '#fafaf6',
      'gray-25': '#f5f5ef',
      'gray-50': '#edeee6',
      'gray-100': '#e2e4d9',
      'gray-200': '#d0d4c5',
      'gray-300': '#b2b8a5',
      'gray-400': '#8a917d',
      'gray-500': '#666d5a',
      'gray-600': '#4c5242',
      'gray-800': '#282b21',
      'gray-900': '#161811',
      accent: '#b5652b',
      'accent-600': '#985424',
      'accent-700': '#76411c',
      'accent-tint': '#f7ede4',
    }),
  },
  {
    id: 'yoru',
    label: '夜',
    colorScheme: 'dark',
    backdrop: { image: yoru, ...DARK_BACKDROP },
    ambience: 'yoru',
    tokens: preset({
      'gray-0': '#0f1411',
      'gray-25': '#131a16',
      'gray-50': '#18201b',
      'gray-100': '#1f2923',
      'gray-200': '#2a362f',
      'gray-300': '#3b4a41',
      'gray-400': '#58695e',
      'gray-500': '#7d8f83',
      'gray-600': '#a3b3a8',
      'gray-800': '#d6e0d9',
      'gray-900': '#eef3ef',
      accent: '#cfdc62',
      'accent-600': '#d9e47f',
      'accent-700': '#e3ec9e',
      'accent-tint': '#2e3320',
    }),
  },
  {
    id: 'takibi',
    label: '焚き火',
    colorScheme: 'dark',
    backdrop: { image: takibi, ...DARK_BACKDROP },
    ambience: 'takibi',
    tokens: preset({
      'gray-0': '#15110e',
      'gray-25': '#1a1512',
      'gray-50': '#211a16',
      'gray-100': '#2a221d',
      'gray-200': '#372d26',
      'gray-300': '#4b3e35',
      'gray-400': '#6c5b4f',
      'gray-500': '#917e70',
      'gray-600': '#b8a697',
      'gray-800': '#e3d7cc',
      'gray-900': '#f5eee8',
      accent: '#f0883e',
      'accent-600': '#f39d5e',
      'accent-700': '#f6b582',
      'accent-tint': '#3b2616',
    }),
  },
  {
    id: 'ame',
    label: '雨',
    colorScheme: 'dark',
    backdrop: { image: ame, ...DARK_BACKDROP },
    ambience: 'ame',
    tokens: preset({
      'gray-0': '#10151b',
      'gray-25': '#141a21',
      'gray-50': '#192028',
      'gray-100': '#202833',
      'gray-200': '#2b3541',
      'gray-300': '#3c4856',
      'gray-400': '#5a6878',
      'gray-500': '#7f8d9d',
      'gray-600': '#a6b2c0',
      'gray-800': '#d8dfe7',
      'gray-900': '#eef2f6',
      accent: '#6cc4d4',
      'accent-600': '#8ad0dd',
      'accent-700': '#a9dce6',
      'accent-tint': '#1c3138',
    }),
  },
] as const satisfies readonly {
  id: string
  label: string
  colorScheme: 'light' | 'dark'
  backdrop: Backdrop | null
  /** テーマに合わせて流す BGM（ambience.ts） */
  ambience: AmbienceId | null
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
  /** 背景の画像。カスタムは元のプリセットのものを使う */
  backdrop: Backdrop | null
  /** テーマに合わせて流す BGM。カスタムは元のプリセットのものを使う */
  ambience: AmbienceId | null
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
      backdrop: base.backdrop,
      ambience: base.ambience,
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

/** `#rgb` / `#rrggbb` / `#rrggbbaa` に濃さを掛けて rgba() にする */
export function withAlpha(hex: string, alpha: number): string {
  const digits = hex.length === 4 ? hex.slice(1).replaceAll(/./g, (c) => c + c) : hex.slice(1)
  const [r, g, b, a = 255] = (digits.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16))
  return `rgba(${r}, ${g}, ${b}, ${Number(((a / 255) * alpha).toFixed(3))})`
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
  const background = resolveToken(theme.tokens, 'background') ?? '#ffffff'
  const { backdrop } = theme
  root.style.setProperty('--backdrop-image', backdrop ? `url("${backdrop.image}")` : 'none')
  root.style.setProperty('--backdrop-blur', `${backdrop?.blur ?? 0}px`)
  root.style.setProperty(
    '--backdrop-veil',
    backdrop ? withAlpha(background, backdrop.veil) : 'transparent',
  )
  root.style.setProperty(
    '--backdrop-paper',
    backdrop ? withAlpha(background, backdrop.paper) : 'transparent',
  )
}
