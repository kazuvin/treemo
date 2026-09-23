/** DIAGRAM の図の倍率。文字の大きさ（font-size.ts）と同じく、決まった段から選ぶ */
export const DEFAULT_ZOOM = 1
export const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2] as const

/** 選べる倍率のうち、いちばん近いものに寄せる */
export function sanitizeZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return DEFAULT_ZOOM
  }
  return ZOOM_LEVELS.reduce((best, z) => (Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best))
}

/** 1 段大きく（delta = 1）/ 小さく（-1）する。端ではそのまま */
export function stepZoom(zoom: number, delta: 1 | -1): number {
  const index = ZOOM_LEVELS.indexOf(sanitizeZoom(zoom) as (typeof ZOOM_LEVELS)[number])
  return ZOOM_LEVELS[Math.min(Math.max(index + delta, 0), ZOOM_LEVELS.length - 1)] ?? zoom
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
