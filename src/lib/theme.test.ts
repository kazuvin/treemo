import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  blend,
  COLOR_TOKENS,
  contrastRatio,
  copyTheme,
  type CustomTheme,
  DEFAULT_THEME,
  minTextAlpha,
  nextCustomLabel,
  parseTokenValue,
  resolveTheme,
  resolveToken,
  sanitizeCustomThemes,
  textSurfaces,
  THEMES,
  TRANSLUCENT_TEXT,
  withAlpha,
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

describe('背景画像', () => {
  it('画像のあるプリセットは、画像と background の色を重ねる変数を書く', () => {
    const root = document.createElement('html')
    applyTheme(resolveTheme('yama', []), root)
    expect(root.style.getPropertyValue('--backdrop-image')).toMatch(/^url\(".+yama.+"\)$/)
    expect(root.style.getPropertyValue('--backdrop-blur')).toBe('28px')
    expect(root.style.getPropertyValue('--backdrop-veil')).toBe('rgba(251, 251, 253, 0.55)')
  })

  it('画像の無いプリセットは変数を空にする', () => {
    const root = document.createElement('html')
    applyTheme(resolveTheme('yama', []), root)
    applyTheme(resolveTheme('kotoba', []), root)
    expect(root.style.getPropertyValue('--backdrop-image')).toBe('none')
    expect(root.style.getPropertyValue('--backdrop-blur')).toBe('0px')
    expect(root.style.getPropertyValue('--backdrop-paper')).toBe('transparent')
  })

  it('カスタムは元のプリセットの画像を使う', () => {
    expect(resolveTheme('custom-1', [{ ...custom, base: 'yoru' }]).backdrop).toBe(
      resolveTheme('yoru', []).backdrop,
    )
  })

  it('写真の上の文字は透かし、画像の無いプリセットに替えると不透明に戻す', () => {
    const root = document.createElement('html')
    applyTheme(resolveTheme('yama', []), root)
    expect(root.style.getPropertyValue('--color-foreground')).toBe('rgba(22, 25, 34, 0.82)')
    applyTheme(resolveTheme('kotoba', []), root)
    expect(root.style.getPropertyValue('--color-foreground')).toBe('var(--color-gray-900)')
  })

  describe.each(THEMES.flatMap((theme) => (theme.backdrop ? [[theme.id, theme] as const] : [])))(
    '%s の透かした文字',
    (_, theme) => {
      const surfaces = textSurfaces(theme.tokens, theme.backdrop)
      it.each(TRANSLUCENT_TEXT)('$token はどの面の上でも $ratio:1 を保つか、透かさない', (text) => {
        const color = resolveToken(theme.tokens, text.token) ?? ''
        const alpha = minTextAlpha(color, surfaces, text.ratio)
        for (const surface of surfaces) {
          const ratio = contrastRatio(blend(color, surface, alpha), surface)
          expect(alpha === 1 || ratio >= text.ratio).toBe(true)
        }
      })

      it('本文の文字は透けている', () => {
        const color = resolveToken(theme.tokens, 'foreground') ?? ''
        expect(minTextAlpha(color, surfaces, 7)).toBeLessThan(1)
      })
    },
  )

  it('コントラスト比は WCAG 2 の式で測る', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(blend('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it.each([
    ['#ffffff', 0.5, 'rgba(255, 255, 255, 0.5)'],
    ['#abc', 1, 'rgba(170, 187, 204, 1)'],
    ['#00000080', 0.5, 'rgba(0, 0, 0, 0.251)'],
  ])('withAlpha(%s, %s) → %s', (hex, alpha, expected) => {
    expect(withAlpha(hex, alpha)).toBe(expected)
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
