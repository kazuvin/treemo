/**
 * 配置が変わったときの動き（docs/tree-block.md の「動き」）。
 * ノードの ID は添字の並びなので、操作の前後で同じ ID が同じノードとは限らない。
 * 前後の見えているノードを突き合わせて、どのノードがどこから来たかを決める。
 */
import type { Rect } from './layout'

export interface VisibleNode {
  id: string
  depth: number
  content: string
}

/**
 * 新しい ID → 古い ID。見つからないノードは新しく現れたものとみなす。
 * 前後から一致する並びを取り、残った真ん中は中身か場所の同じものどうしを結ぶ
 */
export function matchNodes(
  prev: readonly VisibleNode[],
  next: readonly VisibleNode[],
): Map<string, string> {
  // 空の中身は足したばかりのノードと見分けられないので、同じ場所にあるときだけ同じとみなす
  const same = (a?: VisibleNode, b?: VisibleNode) =>
    a !== undefined &&
    b !== undefined &&
    a.depth === b.depth &&
    a.content === b.content &&
    (a.content !== '' || a.id === b.id)
  const out = new Map<string, string>()
  const pair = (old?: VisibleNode, node?: VisibleNode) => {
    if (old && node) {
      out.set(node.id, old.id)
    }
  }
  let head = 0
  while (same(prev[head], next[head])) {
    pair(prev[head], next[head])
    head++
  }
  let tail = 0
  while (
    tail < prev.length - head &&
    tail < next.length - head &&
    same(prev.at(-1 - tail), next.at(-1 - tail))
  ) {
    pair(prev.at(-1 - tail), next.at(-1 - tail))
    tail++
  }
  const rest = prev.slice(head, prev.length - tail)
  const used = new Set<number>()
  const middle = next.slice(head, next.length - tail)
  const bind = (match: (old: VisibleNode, node: VisibleNode) => boolean) => {
    for (const node of middle) {
      if (out.has(node.id)) {
        continue
      }
      const i = rest.findIndex((old, j) => !used.has(j) && match(old, node))
      if (i >= 0) {
        used.add(i)
        pair(rest[i], node)
      }
    }
  }
  // 字下げや入れ替えでは深さや順が変わるので、真ん中はまず中身だけで結ぶ。
  // 残りは同じ場所にあるものどうし（ノード編集で中身が書き換わったもの）
  bind((old, node) => node.content !== '' && old.content === node.content)
  bind((old, node) => old.id === node.id)
  return out
}

/** 始まりと終わりをゆるめる（smoothstep） */
export function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** 位置だけを補間する。大きさはノードの箱がすぐに変わるので、辺の端もそれに合わせる */
export function lerpPosition(from: Rect, to: Rect, t: number): Rect {
  return { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}
