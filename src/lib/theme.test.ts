import { describe, expect, it } from 'vitest'
import { applyTheme, DEFAULT_THEME, THEME_IDS } from './theme'

describe('applyTheme', () => {
  it('<html> に data-theme と color-scheme を書く', () => {
    const root = document.createElement('html')
    applyTheme(DEFAULT_THEME, root)
    expect(root.dataset.theme).toBe('kotoba')
    expect(root.style.colorScheme).toBe('light')
  })

  it('既定のテーマが一覧にある', () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME)
  })
})
