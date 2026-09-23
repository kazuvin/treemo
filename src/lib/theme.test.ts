import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  COLOR_TOKENS,
  copyTheme,
  type CustomTheme,
  DEFAULT_THEME,
  nextCustomLabel,
  parseTokenValue,
  resolveTheme,
  resolveToken,
  sanitizeCustomThemes,
  THEMES,
  wouldResolve,
} from './theme'
import css from '@/styles/globals.css?raw'

const custom: CustomTheme = {
  id: 'custom-1',
  label: 'カスタム',
  base: 'kotoba-dark',
  tokens: { accent: '#00ff00', ring: 'gray-500' },
}

describe('applyTheme', () => {
  it('<html> に data-theme と color-scheme を書く', () => {
    const root = document.createElement('html')
    applyTheme(resolveTheme(DEFAULT_THEME, []), root)
    expect(root.dataset.theme).toBe('kotoba')
    expect(root.style.colorScheme).toBe('light')
  })

  it('カスタムは元のプリセットに変えたトークンを重ねて書く', () => {
    const root = document.createElement('html')
    applyTheme(resolveTheme('custom-1', [custom]), root)
    expect(root.dataset.theme).toBe('custom-1')
    expect(root.style.colorScheme).toBe('dark')
    expect(root.style.getPropertyValue('--color-accent')).toBe('#00ff00')
    expect(root.style.getPropertyValue('--color-ring')).toBe('var(--color-gray-500)')
    expect(root.style.getPropertyValue('--color-gray-0')).toBe('#16161a')
  })
})

describe('resolveTheme', () => {
  it('無い ID なら既定のテーマ', () => {
    expect(resolveTheme('gone', []).id).toBe(DEFAULT_THEME)
  })
})

describe('プリセット', () => {
  it.each(THEMES.map((t) => [t.id]))('%s のトークンはどれも色へ辿れる', (id) => {
    const { tokens } = resolveTheme(id, [])
    for (const token of COLOR_TOKENS) {
      expect(resolveToken(tokens, token)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('Kotoba は globals.css の @theme と同じ値を持つ', () => {
    const { tokens } = resolveTheme('kotoba', [])
    for (const token of COLOR_TOKENS) {
      const match = new RegExp(`--color-${token}: ([^;]+);`).exec(css)
      expect([token, match?.[1]?.replace(/^var\(--color-(.+)\)$/, '$1')]).toEqual([
        token,
        tokens[token],
      ])
    }
  })
})

describe('resolveToken', () => {
  it('指し合っていれば null', () => {
    const { tokens } = resolveTheme('kotoba', [])
    expect(resolveToken({ ...tokens, ring: 'selected', selected: 'ring' }, 'ring')).toBeNull()
  })
})

describe('parseTokenValue', () => {
  it.each([
    ['#ABCDEF', '#abcdef'],
    ['#abc', '#abc'],
    [' gray-900 ', 'gray-900'],
    ['--color-accent', 'accent'],
    ['var(--color-accent)', 'accent'],
    ['red', null],
    ['#12345', null],
    ['gray-700', null],
  ])('%s → %s', (input, expected) => {
    expect(parseTokenValue(input)).toBe(expected)
  })
})

describe('wouldResolve', () => {
  it('輪になる変更を見つける', () => {
    const { tokens } = resolveTheme('kotoba', [])
    expect(wouldResolve(tokens, 'gray-900', 'foreground')).toBe(false)
    expect(wouldResolve(tokens, 'foreground', 'gray-800')).toBe(true)
  })
})

describe('カスタム', () => {
  it('写すと、元のプリセットと変えたトークンを引き継ぎ、空いている名前を付ける', () => {
    const copy = copyTheme(resolveTheme('custom-1', [custom]), [custom])
    expect(copy).toEqual({
      id: 'custom-2',
      label: 'カスタム 2',
      base: 'kotoba-dark',
      tokens: custom.tokens,
    })
    expect(nextCustomLabel([])).toBe('カスタム')
  })

  it('読めないもの・輪になっているものを捨て、読めないトークンだけを落とす', () => {
    expect(
      sanitizeCustomThemes([
        { ...custom, tokens: { accent: '#00FF00', nope: '#000000', ring: 'red' } },
        { id: 'custom-2', label: 'x', base: 'gone', tokens: {} },
        {
          id: 'custom-3',
          label: 'x',
          base: 'kotoba',
          tokens: { ring: 'selected', selected: 'ring' },
        },
        { id: 'kotoba', label: 'x', base: 'kotoba', tokens: {} },
        { ...custom },
        'nope',
      ]),
    ).toEqual([{ ...custom, tokens: { accent: '#00ff00' } }])
  })
})
