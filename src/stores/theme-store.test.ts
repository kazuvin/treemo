import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore } from './theme-store'

const store = () => useThemeStore.getState()

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'kotoba', customThemes: [] })
  })

  it('組み込みのプリセットで色を変えると、写したカスタムができてそちらへ移る', () => {
    store().setToken('accent', '#00ff00')
    expect(store().theme).toBe('custom-1')
    expect(store().customThemes).toEqual([
      { id: 'custom-1', label: 'カスタム', base: 'kotoba', tokens: { accent: '#00ff00' } },
    ])
  })

  it('組み込みのプリセットで値を変えなければ、カスタムはできない', () => {
    store().setToken('accent', null)
    store().setToken('ring', 'accent')
    expect(store().customThemes).toEqual([])
  })

  it('カスタムはその場で変え、元の値に戻したトークンは持たない', () => {
    store().setToken('accent', '#00ff00')
    store().setToken('ring', 'gray-500')
    store().setToken('accent', null)
    expect(store().customThemes).toHaveLength(1)
    expect(store().customThemes[0]?.tokens).toEqual({ ring: 'gray-500' })
  })

  it('名前を変え、消すと元のプリセットへ戻る', () => {
    store().duplicateTheme()
    store().renameCustom('custom-1', '夜')
    expect(store().customThemes[0]?.label).toBe('夜')
    store().deleteCustom('custom-1')
    expect(store().theme).toBe('kotoba')
    expect(store().customThemes).toEqual([])
  })
})
