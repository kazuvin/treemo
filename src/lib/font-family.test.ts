import { describe, expect, it } from 'vitest'
import {
  applyFontFamily,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILIES,
  sanitizeFontFamily,
} from './font-family'
import css from '@/styles/globals.css?raw'

describe('sanitizeFontFamily', () => {
  it('選べる書体はそのまま', () => {
    expect(sanitizeFontFamily('hiragino-mincho')).toBe('hiragino-mincho')
  })

  it('知らない書体は既定', () => {
    expect(sanitizeFontFamily('comic-sans')).toBe(DEFAULT_FONT_FAMILY)
  })
})

describe('applyFontFamily', () => {
  it('sans と mono の両方に同じ書体を書く', () => {
    const root = document.createElement('div')
    applyFontFamily('menlo', root)
    const menlo = FONT_FAMILIES.find((f) => f.id === 'menlo')?.stack
    expect(root.style.getPropertyValue('--font-sans')).toBe(menlo)
    expect(root.style.getPropertyValue('--font-mono')).toBe(menlo)
  })
})

it('既定の書体は globals.css の @theme と同じ', () => {
  const stack = FONT_FAMILIES.find((f) => f.id === DEFAULT_FONT_FAMILY)?.stack
  expect(css).toContain(`--font-sans: ${stack};`)
  expect(css).toContain(`--font-mono: ${stack};`)
})
