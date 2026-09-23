/**
 * 本文も UI も 1 つの書体で組む（globals.css の --font-sans / --font-mono）。
 * Noto の 2 つは Fontsource で同梱し、ほかは macOS に入っている書体を名前で指す。
 */
export const FONT_FAMILIES = [
  {
    id: 'noto-mono',
    label: 'Noto Sans Mono（等幅）',
    stack: '"Noto Sans Mono Variable", "Noto Sans JP Variable", ui-monospace, monospace',
  },
  {
    id: 'sf-mono',
    label: 'SF Mono（等幅）',
    stack: 'ui-monospace, "Hiragino Sans", monospace',
  },
  {
    id: 'menlo',
    label: 'Menlo（等幅）',
    stack: 'Menlo, "Hiragino Sans", monospace',
  },
  {
    id: 'noto-sans',
    label: 'Noto Sans JP',
    stack: '"Noto Sans JP Variable", sans-serif',
  },
  {
    id: 'hiragino-sans',
    label: 'ヒラギノ角ゴ',
    stack: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
  {
    id: 'hiragino-mincho',
    label: 'ヒラギノ明朝',
    stack: '"Hiragino Mincho ProN", serif',
  },
] as const

export type FontFamilyId = (typeof FONT_FAMILIES)[number]['id']

export const DEFAULT_FONT_FAMILY: FontFamilyId = 'noto-mono'

export function sanitizeFontFamily(id: string): FontFamilyId {
  return FONT_FAMILIES.find((f) => f.id === id)?.id ?? DEFAULT_FONT_FAMILY
}

export function fontFamilyStack(id: FontFamilyId): string {
  return FONT_FAMILIES.find((f) => f.id === id)?.stack ?? FONT_FAMILIES[0].stack
}

export function applyFontFamily(
  id: FontFamilyId,
  root: HTMLElement = document.documentElement,
): void {
  const stack = fontFamilyStack(id)
  root.style.setProperty('--font-sans', stack)
  root.style.setProperty('--font-mono', stack)
}
