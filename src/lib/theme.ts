/**
 * テーマの一覧。色の値は CSS にあり、ここは名前と `<html data-theme>` に書く ID だけを持つ。
 * 足し方は docs/kotoba-design-system.md の「テーマ」。
 */
export const THEMES = [{ id: 'kotoba', label: 'Kotoba', colorScheme: 'light' }] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'kotoba'

export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]]

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.colorScheme
}
