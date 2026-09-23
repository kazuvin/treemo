import { describe, expect, it } from 'vitest'
import {
  AMBIENCES,
  currentAmbience,
  DEFAULT_BGM_VOLUME,
  sanitizeBgm,
  sanitizeBgmVolume,
  stepBgmVolume,
} from './ambience'
import { resolveTheme, THEMES } from './theme'

describe('currentAmbience', () => {
  it('流さないなら、テーマに音があっても流さない', () => {
    expect(currentAmbience('off', 'ame')).toBeNull()
  })

  it('テーマに合わせるなら、テーマの音', () => {
    expect(currentAmbience('theme', 'ame')?.label).toBe('雨')
  })

  it('テーマに合わせても、テーマに音が無ければ流さない', () => {
    expect(currentAmbience('theme', null)).toBeNull()
  })

  it('音を決めていれば、テーマによらずその音', () => {
    expect(currentAmbience('takibi', 'ame')?.label).toBe('焚き火')
    expect(currentAmbience('takibi', null)?.label).toBe('焚き火')
  })
})

describe('テーマの音', () => {
  it('写真を敷くプリセットは、どれも音を持つ', () => {
    const ids = new Set<string>(AMBIENCES.map((a) => a.id))
    for (const theme of THEMES.filter((t) => t.backdrop)) {
      expect(ids.has(theme.ambience ?? '')).toBe(true)
    }
  })

  it('カスタムは元のプリセットの音を使う', () => {
    const custom = { id: 'custom-1', label: 'カスタム', base: 'takibi' as const, tokens: {} }
    expect(resolveTheme('custom-1', [custom]).ambience).toBe('takibi')
  })
})

describe('保存した値', () => {
  it.each([
    ['off', 'off'],
    ['theme', 'theme'],
    ['umi', 'umi'],
    ['gone', 'off'],
  ])('sanitizeBgm(%s) → %s', (input, expected) => {
    expect(sanitizeBgm(input)).toBe(expected)
  })

  it.each([
    [50, 50],
    [44, 40],
    [0, 10],
    [500, 100],
    [Number.NaN, DEFAULT_BGM_VOLUME],
  ])('sanitizeBgmVolume(%s) → %s', (input, expected) => {
    expect(sanitizeBgmVolume(input)).toBe(expected)
  })

  it('音量は 1 段ずつ変わり、端で止まる', () => {
    expect(stepBgmVolume(50, 1)).toBe(60)
    expect(stepBgmVolume(10, -1)).toBe(10)
    expect(stepBgmVolume(100, 1)).toBe(100)
  })
})
