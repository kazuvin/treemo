/** 本文の文字の大きさ（px）。ほかの段はこれに比例して伸び縮みする（globals.css の --font-scale） */
export const DEFAULT_FONT_SIZE = 14
export const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20] as const

/** 選べる大きさのうち、いちばん近いものに寄せる */
export function sanitizeFontSize(size: number): number {
  if (!Number.isFinite(size)) {
    return DEFAULT_FONT_SIZE
  }
  return FONT_SIZES.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best))
}

/** 1 段大きく（delta = 1）/ 小さく（-1）する。端ではそのまま */
export function stepFontSize(size: number, delta: 1 | -1): number {
  const index = FONT_SIZES.indexOf(sanitizeFontSize(size) as (typeof FONT_SIZES)[number])
  return FONT_SIZES[Math.min(Math.max(index + delta, 0), FONT_SIZES.length - 1)] ?? size
}

export function applyFontSize(size: number, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--font-scale', String(size / DEFAULT_FONT_SIZE))
}
