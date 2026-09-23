/** DIAGRAM の図の倍率。文字の大きさ（font-size.ts）と同じく、決まった段から選ぶ */
export const DEFAULT_ZOOM = 1
export const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2] as const

/** 倍率の設定。'fit' は図が入る場所の大きさに合わせ続ける */
export type Zoom = number | 'fit'

/** 合わせるときは縮めるだけにする。小さい図を大きく描いても読みやすくならないため */
const FIT_MAX = 1
/** 合わせても、これより小さくすると文字が読めない */
const FIT_MIN = 0.25

/** 選べる倍率のうち、いちばん近いものに寄せる */
export function sanitizeZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return DEFAULT_ZOOM
  }
  return ZOOM_LEVELS.reduce((best, z) => (Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best))
}

/**
 * 1 段大きく（delta = 1）/ 小さく（-1）する。端ではそのまま。
 * 合わせた倍率のように段の間にあるときは、その向きの次の段へ移る
 */
export function stepZoom(zoom: number, delta: 1 | -1): number {
  const next =
    delta === 1
      ? ZOOM_LEVELS.find((z) => z > zoom + 1e-6)
      : [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 1e-6)
  return next ?? (delta === 1 ? ZOOM_LEVELS[ZOOM_LEVELS.length - 1] : ZOOM_LEVELS[0]) ?? zoom
}

interface Size {
  width: number
  height: number
}

/**
 * 図（倍率を掛ける前の大きさ）が、使える場所に収まる倍率。axes が 'width' なら幅だけを見る
 * （インラインでは本文と一緒に縦に流れるので、高さは収めなくてよい）
 */
export function fitZoom(content: Size, available: Size, axes: 'width' | 'both'): number {
  const ratios = [available.width / content.width]
  if (axes === 'both') {
    ratios.push(available.height / content.height)
  }
  const ratio = Math.min(...ratios.filter((r) => Number.isFinite(r) && r > 0))
  if (!Number.isFinite(ratio)) {
    return FIT_MAX
  }
  // 丸めで 1px はみ出してスクロールバーが出ないよう、切り捨てる
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.floor(ratio * 100) / 100))
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
