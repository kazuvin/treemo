/**
 * 左から右へ広がるツリーの配置（docs/tree-block.md の「レイアウト」）。
 * 列（深さ）ごとに x をそろえ、縦は部分木の輪郭を突き合わせて詰める。
 */
import type { TreeNode } from '../types/tree'

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export interface LayoutOptions {
  /** 列と列のあいだ */
  columnGap: number
  /** 兄弟の部分木どうしのあいだ */
  siblingGap: number
}

interface Edge {
  from: string
  to: string
  /** 直角に折れる線の頂点（親の右端の中央 → 子の左端の中央） */
  points: [number, number][]
}

export interface TreeLayout {
  rects: Map<string, Rect>
  edges: Edge[]
  width: number
  height: number
}

interface Placement {
  node: TreeNode
  depth: number
  y: number
}

interface Subtree {
  placements: Placement[]
  /** 深さごとの上端と下端 */
  contour: Map<number, [number, number]>
}

function shift(sub: Subtree, dy: number): Subtree {
  return {
    placements: sub.placements.map((p) => ({ ...p, y: p.y + dy })),
    contour: new Map([...sub.contour].map(([d, [top, bottom]]) => [d, [top + dy, bottom + dy]])),
  }
}

/** 先に置いた塊の下に、重ならない最小の間隔で次の部分木を置く */
function stack(subs: Subtree[], gap: number): Subtree {
  const placements: Placement[] = []
  const contour = new Map<number, [number, number]>()
  for (const sub of subs) {
    let dy = 0
    if (placements.length > 0) {
      dy = -Infinity
      for (const [d, [top]] of sub.contour) {
        const above = contour.get(d)
        if (above) {
          dy = Math.max(dy, above[1] + gap - top)
        }
      }
      if (dy === -Infinity) {
        dy = 0
      }
    }
    const moved = shift(sub, dy)
    placements.push(...moved.placements)
    for (const [d, [top, bottom]] of moved.contour) {
      const cur = contour.get(d)
      contour.set(d, cur ? [Math.min(cur[0], top), Math.max(cur[1], bottom)] : [top, bottom])
    }
  }
  return { placements, contour }
}

function place(
  node: TreeNode,
  depth: number,
  sizeOf: (node: TreeNode) => Size,
  gap: number,
): Subtree {
  const { height } = sizeOf(node)
  const children = node.collapsed ? [] : node.children
  if (children.length === 0) {
    return {
      placements: [{ node, depth, y: 0 }],
      contour: new Map([[depth, [0, height]]]),
    }
  }
  const block = stack(
    children.map((child) => place(child, depth + 1, sizeOf, gap)),
    gap,
  )
  const [top, bottom] = block.contour.get(depth + 1) ?? [0, 0]
  const y = (top + bottom) / 2 - height / 2
  block.placements.unshift({ node, depth, y })
  block.contour.set(depth, [y, y + height])
  return block
}

export function layoutTree(
  roots: readonly TreeNode[],
  sizeOf: (node: TreeNode) => Size,
  options: LayoutOptions,
): TreeLayout {
  const all = stack(
    roots.map((root) => place(root, 0, sizeOf, options.siblingGap)),
    options.siblingGap,
  )
  const columnWidths: number[] = []
  for (const p of all.placements) {
    columnWidths[p.depth] = Math.max(columnWidths[p.depth] ?? 0, sizeOf(p.node).width)
  }
  const columnX: number[] = []
  let x = 0
  for (let d = 0; d < columnWidths.length; d++) {
    columnX[d] = x
    x += (columnWidths[d] ?? 0) + options.columnGap
  }
  const minY = Math.min(0, ...all.placements.map((p) => p.y))
  const rects = new Map<string, Rect>()
  let height = 0
  for (const p of all.placements) {
    const size = sizeOf(p.node)
    const rect = { x: columnX[p.depth] ?? 0, y: p.y - minY, ...size }
    rects.set(p.node.id, rect)
    height = Math.max(height, rect.y + rect.height)
  }
  const edges: Edge[] = []
  for (const p of all.placements) {
    if (p.node.collapsed) {
      continue
    }
    const parent = rects.get(p.node.id)
    for (const child of p.node.children) {
      const target = rects.get(child.id)
      if (!parent || !target) {
        continue
      }
      const startX = parent.x + parent.width
      const startY = parent.y + parent.height / 2
      const endX = target.x
      const endY = target.y + target.height / 2
      const midX = (columnX[p.depth + 1] ?? endX) - options.columnGap / 2
      edges.push({
        from: p.node.id,
        to: child.id,
        points: [
          [startX, startY],
          [midX, startY],
          [midX, endY],
          [endX, endY],
        ],
      })
    }
  }
  const width = Math.max(0, x - options.columnGap)
  return { rects, edges, width, height }
}
