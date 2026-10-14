/**
 * ツリーの配置（docs/tree-block.md の「レイアウト」）。左から右へ広がる形で組み、
 * 列（深さ）ごとに x をそろえ、縦は部分木の輪郭を突き合わせて詰める。
 * 上から下へ広がる形は、縦横を入れ替えて同じように組む。
 */
import type { TreeNode } from '../types/tree'
import type { FlowDirection, TreeDirection } from './direction'
import { T_ARMS } from './t-chart'

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export interface LayoutOptions {
  /** 深さの段と段のあいだ（横向きなら列、縦向きなら行） */
  columnGap: number
  /** 兄弟の部分木どうしのあいだ */
  siblingGap: number
  direction?: TreeDirection
}

interface Edge {
  from: string
  to: string
  /** 親から子へ伸びる向き。辺の出入りの向きを決める */
  flow: FlowDirection
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

function transpose<T extends Size>(r: T): T {
  return { ...r, width: r.height, height: r.width }
}

export function layoutTree(
  roots: readonly TreeNode[],
  sizeOf: (node: TreeNode) => Size,
  options: LayoutOptions,
): TreeLayout {
  if (options.direction !== 'tb') {
    return layoutLeftToRight(roots, sizeOf, options)
  }
  const turned = layoutLeftToRight(roots, (node) => transpose(sizeOf(node)), options)
  const rects = new Map<string, Rect>()
  for (const [id, r] of turned.rects) {
    rects.set(id, { x: r.y, y: r.x, width: r.height, height: r.width })
  }
  const edges = turned.edges.map((edge) => ({ ...edge, flow: 'tb' as const }))
  return { rects, edges, width: turned.height, height: turned.width }
}

function layoutLeftToRight(
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
    for (const child of p.node.children) {
      edges.push({ from: p.node.id, to: child.id, flow: 'lr' })
    }
  }
  const width = Math.max(0, x - options.columnGap)
  return { rects, edges, width, height }
}

/**
 * 親の右端の中央から子の左端の中央へ引く S 字の曲線（SVG の path の d）。
 * 両端で水平に出入りするよう、制御点は端点と同じ高さに横へ半分ずつ寄せる。
 * 縦向きでは親の下端の中央から子の上端の中央へ、両端で垂直に出入りする。
 * 右から左では親の左端から子の右端へ引く
 */
export function edgePath(parent: Rect, child: Rect, direction: FlowDirection = 'lr'): string {
  if (direction === 'tb') {
    const sx = parent.x + parent.width / 2
    const sy = parent.y + parent.height
    const ex = child.x + child.width / 2
    const ey = child.y
    const k = Math.max(0, ey - sy) / 2
    return `M${sx},${sy} C${sx},${sy + k} ${ex},${ey - k} ${ex},${ey}`
  }
  if (direction === 'rl') {
    const sx = parent.x
    const sy = parent.y + parent.height / 2
    const ex = child.x + child.width
    const ey = child.y + child.height / 2
    const k = Math.max(0, sx - ex) / 2
    return `M${sx},${sy} C${sx - k},${sy} ${ex + k},${ey} ${ex},${ey}`
  }
  const sx = parent.x + parent.width
  const sy = parent.y + parent.height / 2
  const ex = child.x
  const ey = child.y + child.height / 2
  const k = Math.max(0, ex - sx) / 2
  return `M${sx},${sy} C${sx + k},${sy} ${ex - k},${ey} ${ex},${ey}`
}

export interface TChartLayoutOptions {
  /** 中心と問いのあいだ */
  stemGap: number
  /** 横の腕（それで？・本当に？）の中の間隔 */
  side: Omit<LayoutOptions, 'direction'>
  /** 下の腕（なぜ？）の中の間隔 */
  down: Omit<LayoutOptions, 'direction'>
  /** 横の腕の下端と、下の腕の上端のあいだ */
  armGap: number
  /** 図の左右と下に空けておく幅。腕の先にノードを足す印が入る */
  margin: number
}

function bounds(rects: Iterable<Rect>): {
  left: number
  top: number
  right: number
  bottom: number
} {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const r of rects) {
    left = Math.min(left, r.x)
    top = Math.min(top, r.y)
    right = Math.max(right, r.x + r.width)
    bottom = Math.max(bottom, r.y + r.height)
  }
  return { left, top, right, bottom }
}

/**
 * T 字の図の配置（docs/t-chart.md の「レイアウト」）。中心の左右と下に問いを置き、
 * 問いから先の答えはその腕の向きのツリーとして組む。下の腕が横の腕と重なるときは、
 * 横の腕の下まで下ろす（T の縦棒が伸びる）
 */
export function layoutTChart(
  roots: readonly TreeNode[],
  sizeOf: (node: TreeNode) => Size,
  options: TChartLayoutOptions,
): TreeLayout {
  const center = roots[0]
  if (!center) {
    return { rects: new Map(), edges: [], width: 0, height: 0 }
  }
  const c = { x: 0, y: 0, ...sizeOf(center) }
  const questions = center.collapsed ? [] : center.children
  const arms = questions.map((question, i) => {
    const flow = T_ARMS[i]?.flow ?? 'lr'
    const arm =
      flow === 'tb'
        ? layoutTree([question], sizeOf, { ...options.down, direction: 'tb' })
        : layoutTree([question], sizeOf, options.side)
    const mirror = (r: Rect): Rect => (flow === 'rl' ? { ...r, x: -r.x - r.width } : r)
    const q = mirror(arm.rects.get(question.id) ?? { ...c, x: 0, y: 0 })
    let dx = c.width / 2 - (q.x + q.width / 2)
    let dy = c.height + options.stemGap - q.y
    if (flow !== 'tb') {
      dx = flow === 'lr' ? c.width + options.stemGap - q.x : -options.stemGap - (q.x + q.width)
      dy = c.height / 2 - (q.y + q.height / 2)
    }
    const placed = new Map<string, Rect>()
    for (const [id, r] of arm.rects) {
      const m = mirror(r)
      placed.set(id, { ...m, x: m.x + dx, y: m.y + dy })
    }
    const edges = [
      { from: center.id, to: question.id, flow },
      ...arm.edges.map((edge) => ({ ...edge, flow })),
    ]
    return { flow, placed, edges }
  })
  // 横の腕は辺も含めて箱で避ける。ノードだけを避けると、問いから答えへの辺が下の腕のノードを横切る
  const sideBoxes = arms
    .filter((arm) => arm.flow !== 'tb' && arm.placed.size > 0)
    .map((arm) => bounds(arm.placed.values()))
  const rects = new Map<string, Rect>([[center.id, c]])
  const edges: Edge[] = []
  for (const arm of arms) {
    let push = 0
    if (arm.flow === 'tb') {
      const box = bounds(arm.placed.values())
      for (const other of sideBoxes) {
        if (other.left < box.right && box.left < other.right) {
          push = Math.max(push, other.bottom + options.armGap - box.top)
        }
      }
    }
    for (const [id, r] of arm.placed) {
      rects.set(id, { ...r, y: r.y + push })
    }
    edges.push(...arm.edges)
  }
  const box = bounds(rects.values())
  const moved = new Map<string, Rect>()
  for (const [id, r] of rects) {
    moved.set(id, { ...r, x: r.x - box.left + options.margin, y: r.y - box.top })
  }
  return {
    rects: moved,
    edges,
    width: box.right - box.left + options.margin * 2,
    height: box.bottom - box.top + options.margin,
  }
}
