import { describe, expect, it } from 'vitest'
import { DEFAULT_ZOOM, sanitizeZoom, stepZoom, zoomLabel } from './zoom'

describe('sanitizeZoom', () => {
  it('選べる倍率のうち近いものに寄せる', () => {
    expect(sanitizeZoom(1.3)).toBe(1.25)
    expect(sanitizeZoom(9)).toBe(2)
    expect(sanitizeZoom(0)).toBe(0.5)
  })

  it('数でなければ既定にする', () => {
    expect(sanitizeZoom(Number.NaN)).toBe(DEFAULT_ZOOM)
  })
})

describe('stepZoom', () => {
  it('1 段ずつ上げ下げする', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1, -1)).toBe(0.9)
  })

  it('端ではそのまま', () => {
    expect(stepZoom(2, 1)).toBe(2)
    expect(stepZoom(0.5, -1)).toBe(0.5)
  })
})

describe('zoomLabel', () => {
  it('百分率で書く', () => {
    expect(zoomLabel(0.67)).toBe('67%')
    expect(zoomLabel(1.25)).toBe('125%')
  })
})
