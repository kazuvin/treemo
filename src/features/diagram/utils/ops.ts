/**
 * DIAGRAM モードの操作（docs/tree-block.md の「DIAGRAM モードの操作とテキストの変化」）。
 * どれも元のツリーを変えずに新しいツリーを返す。
 */
import type { NodePath, TreeNode } from '../types/tree'
import { assignIds } from './parse'

export interface OpResult {
  roots: TreeNode[]
  /** 操作のあとに選ぶノード。null ならどれも選ばない */
  path: number[] | null
}

export function emptyNode(content = ''): TreeNode {
  return { id: '', content, children: [] }
}

function cloneTree(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes.map((node) => ({ ...node, children: cloneTree(node.children) }))
}

export function getNode(roots: readonly TreeNode[], path: NodePath): TreeNode | null {
  let list = roots
  let node: TreeNode | null = null
  for (const i of path) {
    node = list[i] ?? null
    if (!node) {
      return null
    }
    list = node.children
  }
  return node
}

/** 兄弟の並び（親の children かルートの配列）を、複製したツリーの中で返す */
function siblingsIn(roots: TreeNode[], path: NodePath): TreeNode[] | null {
  if (path.length === 0) {
    return null
  }
  if (path.length === 1) {
    return roots
  }
  return getNode(roots, path.slice(0, -1))?.children ?? null
}

function finish(roots: TreeNode[], path: number[] | null): OpResult {
  assignIds(roots, '')
  return { roots, path }
}

export function insertSibling(
  roots: readonly TreeNode[],
  path: NodePath,
  where: 'above' | 'below',
  nodes: readonly TreeNode[] = [emptyNode()],
): OpResult {
  const next = cloneTree(roots)
  const inserted = cloneTree(nodes)
  if (path.length === 0) {
    const at = where === 'above' ? 0 : next.length
    next.splice(at, 0, ...inserted)
    return finish(next, [at])
  }
  const siblings = siblingsIn(next, path)
  const index = path.at(-1) ?? 0
  if (!siblings) {
    return finish(next, [...path])
  }
  const at = where === 'above' ? index : index + 1
  siblings.splice(at, 0, ...inserted)
  return finish(next, [...path.slice(0, -1), at])
}

export function appendChild(
  roots: readonly TreeNode[],
  path: NodePath,
  nodes: readonly TreeNode[] = [emptyNode()],
): OpResult {
  const next = cloneTree(roots)
  const parent = getNode(next, path)
  if (!parent) {
    return finish(next, path.length ? [...path] : null)
  }
  parent.collapsed = false
  parent.children.push(...cloneTree(nodes))
  return finish(next, [...path, parent.children.length - nodes.length])
}

export function removeNode(
  roots: readonly TreeNode[],
  path: NodePath,
): OpResult & { removed: TreeNode | null } {
  const next = cloneTree(roots)
  const siblings = siblingsIn(next, path)
  const index = path.at(-1) ?? 0
  const removed = siblings?.[index]
  if (!siblings || !removed) {
    return { ...finish(next, path.length ? [...path] : null), removed: null }
  }
  siblings.splice(index, 1)
  let selected: number[] | null
  if (siblings.length > index) {
    selected = [...path]
  } else if (index > 0) {
    selected = [...path.slice(0, -1), index - 1]
  } else {
    selected = path.length > 1 ? path.slice(0, -1) : null
  }
  return { ...finish(next, selected), removed }
}

/** 直前の兄弟の最後の子に移す */
export function indentNode(roots: readonly TreeNode[], path: NodePath): OpResult | null {
  const index = path.at(-1) ?? 0
  if (path.length === 0 || index === 0) {
    return null
  }
  const next = cloneTree(roots)
  const siblings = siblingsIn(next, path)
  const prev = siblings?.[index - 1]
  const node = siblings?.[index]
  if (!siblings || !prev || !node) {
    return null
  }
  siblings.splice(index, 1)
  prev.collapsed = false
  prev.children.push(node)
  return finish(next, [...path.slice(0, -1), index - 1, prev.children.length - 1])
}

/** 親の直後の兄弟に移す */
export function outdentNode(roots: readonly TreeNode[], path: NodePath): OpResult | null {
  if (path.length < 2) {
    return null
  }
  const next = cloneTree(roots)
  const parentPath = path.slice(0, -1)
  const parent = getNode(next, parentPath)
  const parentSiblings = siblingsIn(next, parentPath)
  const index = path.at(-1) ?? 0
  const node = parent?.children[index]
  if (!parent || !parentSiblings || !node) {
    return null
  }
  parent.children.splice(index, 1)
  const parentIndex = parentPath.at(-1) ?? 0
  parentSiblings.splice(parentIndex + 1, 0, node)
  return finish(next, [...parentPath.slice(0, -1), parentIndex + 1])
}

export function swapNode(
  roots: readonly TreeNode[],
  path: NodePath,
  direction: 'up' | 'down',
): OpResult | null {
  const index = path.at(-1) ?? 0
  const other = direction === 'up' ? index - 1 : index + 1
  const next = cloneTree(roots)
  const siblings = siblingsIn(next, path)
  const a = siblings?.[index]
  const b = siblings?.[other]
  if (!siblings || !a || !b) {
    return null
  }
  siblings[index] = b
  siblings[other] = a
  return finish(next, [...path.slice(0, -1), other])
}

export function setContent(roots: readonly TreeNode[], path: NodePath, content: string): OpResult {
  const next = cloneTree(roots)
  const node = getNode(next, path)
  if (node) {
    node.content = content
  }
  return finish(next, [...path])
}

export function toggleCollapsed(roots: readonly TreeNode[], path: NodePath): OpResult {
  const next = cloneTree(roots)
  const node = getNode(next, path)
  if (node && node.children.length > 0) {
    node.collapsed = !node.collapsed
  }
  return finish(next, [...path])
}

export function setAllCollapsed(roots: readonly TreeNode[], collapsed: boolean): TreeNode[] {
  const next = cloneTree(roots)
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      node.collapsed = collapsed && node.children.length > 0
      walk(node.children)
    }
  }
  walk(next)
  return next
}

/** 折りたたんだノードの配下を除いた、見えているノードのパスを上から順に */
export function visiblePaths(roots: readonly TreeNode[]): number[][] {
  const out: number[][] = []
  const walk = (nodes: readonly TreeNode[], prefix: number[]) => {
    nodes.forEach((node, i) => {
      const path = [...prefix, i]
      out.push(path)
      if (!node.collapsed) {
        walk(node.children, path)
      }
    })
  }
  walk(roots, [])
  return out
}

/**
 * 見えているノードのうち、同じ深さで上（下）にある最初のノード。兄弟が尽きたら親を
 * 跨いで、いとこへ移る。上から順に並べると、次の兄弟は子孫のすぐ後に来るので、深さで
 * 絞るだけで兄弟が先に見つかる。
 */
export function sameDepthNeighbor(
  roots: readonly TreeNode[],
  path: NodePath,
  direction: 'up' | 'down',
): number[] | null {
  const peers = visiblePaths(roots).filter((p) => p.length === path.length)
  const key = path.join('.')
  const index = peers.findIndex((p) => p.join('.') === key)
  if (index < 0) {
    return null
  }
  return peers[index + (direction === 'up' ? -1 : 1)] ?? null
}

/** 折りたたみの状態を、ID（パス）の集合として取り出す */
export function collapsedIds(roots: readonly TreeNode[]): string[] {
  const out: string[] = []
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (node.collapsed) {
        out.push(node.id)
      }
      walk(node.children)
    }
  }
  walk(roots)
  return out
}

export function applyCollapsed(roots: TreeNode[], ids: ReadonlySet<string>): void {
  for (const node of roots) {
    node.collapsed = ids.has(node.id) && node.children.length > 0
    applyCollapsed(node.children, ids)
  }
}

/** パスが指すノードが無ければ、近いノードに寄せる */
export function clampPath(roots: readonly TreeNode[], path: NodePath | null): number[] | null {
  if (roots.length === 0) {
    return null
  }
  if (!path || path.length === 0) {
    return [0]
  }
  const out: number[] = []
  let list = roots
  for (const i of path) {
    if (list.length === 0) {
      break
    }
    const index = Math.min(i, list.length - 1)
    out.push(index)
    const node = list[index]
    if (!node || node.collapsed) {
      break
    }
    list = node.children
  }
  return out
}
