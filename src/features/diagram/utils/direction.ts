/**
 * ツリーの向き。info 文字列の `layout=` で持つ（docs/tree-block.md の「フェンス」）。
 * lr は左から右（既定）、tb は上から下
 */
export type TreeDirection = 'lr' | 'tb'

/** 画面の上での向き。h / j / k / l と H / J / K / L が指す */
export type ScreenDirection = 'left' | 'right' | 'up' | 'down'

const LAYOUT_KEY = /^layout=/

export function directionOf(info: string): TreeDirection {
  const token = info.split(/\s+/).find((t) => LAYOUT_KEY.test(t))
  return token === 'layout=tb' ? 'tb' : 'lr'
}

/** info 文字列の向きだけを書き換える。ほかの設定と並びはそのまま残す */
export function withDirection(info: string, direction: TreeDirection): string {
  const tokens = info.split(/\s+/).filter((t) => t !== '')
  let next = tokens.filter((t) => !LAYOUT_KEY.test(t))
  if (direction === 'tb') {
    next = tokens.some((t) => LAYOUT_KEY.test(t))
      ? tokens.map((t) => (LAYOUT_KEY.test(t) ? 'layout=tb' : t))
      : [...tokens, 'layout=tb']
  }
  return next.length > 0 ? ` ${next.join(' ')}` : ''
}

/**
 * 画面の向きを、ツリーの上での動きに読み替える。横向きなら左右が親と子、上下が兄弟。
 * 縦向きなら上下が親と子、左右が兄弟になる
 */
export function treeMove(
  direction: TreeDirection,
  screen: ScreenDirection,
): 'parent' | 'child' | 'prev' | 'next' {
  const moves = {
    lr: { left: 'parent', right: 'child', up: 'prev', down: 'next' },
    tb: { up: 'parent', down: 'child', left: 'prev', right: 'next' },
  } as const
  return moves[direction][screen]
}
