import { describe, expect, it } from 'vitest'
import { DEFAULT_ZOOM, fitZoom, sanitizeZoom, stepZoom, zoomLabel } from './zoom'

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

  it('段の間からは、その向きの次の段へ移る', () => {
    expect(stepZoom(0.72, 1)).toBe(0.8)
    expect(stepZoom(0.72, -1)).toBe(0.67)
    expect(stepZoom(0.3, 1)).toBe(0.5)
  })

  it('端ではそのまま', () => {
    expect(stepZoom(2, 1)).toBe(2)
    expect(stepZoom(0.5, -1)).toBe(0.5)
  })

  it('段より外からは端の段へ戻す', () => {
    expect(stepZoom(0.3, -1)).toBe(0.5)
  })
})

describe('fitZoom', () => {
  it('幅だけを見て、はみ出す図を縮める', () => {
    expect(fitZoom({ width: 1000, height: 5000 }, { width: 600, height: 300 }, 'width')).toBe(0.6)
  })

  it('両方を見るときは、きつい方に合わせる', () => {
    expect(fitZoom({ width: 1000, height: 1000 }, { width: 600, height: 300 }, 'both')).toBe(0.3)
  })

  it('収まる図は大きくしない', () => {
    expect(fitZoom({ width: 200, height: 100 }, { width: 600, height: 300 }, 'both')).toBe(1)
  })

  it('小さくしすぎない', () => {
    expect(fitZoom({ width: 10000, height: 100 }, { width: 600, height: 300 }, 'width')).toBe(0.25)
  })

  it('切り捨てて、はみ出さないようにする', () => {
    expect(fitZoom({ width: 300, height: 100 }, { width: 200, height: 300 }, 'width')).toBe(0.66)
  })

  it('場所を測れないうちは 100% にする', () => {
    expect(fitZoom({ width: 300, height: 100 }, { width: 0, height: 0 }, 'both')).toBe(1)
  })
})

describe('zoomLabel', () => {
  it('百分率で書く', () => {
    expect(zoomLabel(0.67)).toBe('67%')
    expect(zoomLabel(1.25)).toBe('125%')
  })
})
