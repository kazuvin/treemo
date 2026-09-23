import { describe, expect, it } from 'vitest'
import { applyFontSize, DEFAULT_FONT_SIZE, sanitizeFontSize, stepFontSize } from './font-size'

describe('sanitizeFontSize', () => {
  it('選べる大きさはそのまま', () => {
    expect(sanitizeFontSize(16)).toBe(16)
  })

  it('選べない値は近いものに寄せる', () => {
    expect(sanitizeFontSize(19.5)).toBe(20)
    expect(sanitizeFontSize(100)).toBe(20)
    expect(sanitizeFontSize(3)).toBe(12)
  })

  it('数でなければ既定', () => {
    expect(sanitizeFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE)
  })
})

describe('stepFontSize', () => {
  it('1 段ずつ動く', () => {
    expect(stepFontSize(14, 1)).toBe(15)
    expect(stepFontSize(18, 1)).toBe(20)
    expect(stepFontSize(14, -1)).toBe(13)
  })

  it('端では止まる', () => {
    expect(stepFontSize(20, 1)).toBe(20)
    expect(stepFontSize(12, -1)).toBe(12)
  })
})

describe('applyFontSize', () => {
  it('14px を 1 とした倍率を書く', () => {
    const root = document.createElement('div')
    applyFontSize(21, root)
    expect(root.style.getPropertyValue('--font-scale')).toBe('1.5')
  })
})
