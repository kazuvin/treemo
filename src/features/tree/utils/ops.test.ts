import type { TreeNode } from '../types/tree'
import {
  appendChild,
  clampPath,
  indentNode,
  insertSibling,
  outdentNode,
  removeNode,
  sameDepthNeighbor,
  swapNode,
  toggleCollapsed,
  visiblePaths,
} from './ops'
import { parseNodes } from './parse'
import { serializeNodes } from './serialize'

function tree(...lines: string[]): TreeNode[] {
  return parseNodes(lines).roots
}

function text(roots: readonly TreeNode[]): string[] {
  return serializeNodes(roots)
}

const base = tree('- a', '  - a1', '  - a2', '- b')

describe('insertSibling', () => {
  it('adds an empty node below the subtree', () => {
    const result = insertSibling(base, [0], 'below')
    expect(text(result.roots)).toEqual(['- a', '  - a1', '  - a2', '-', '- b'])
    expect(result.path).toEqual([1])
  })

  it('adds an empty node above', () => {
    const result = insertSibling(base, [0, 1], 'above')
    expect(text(result.roots)).toEqual(['- a', '  - a1', '  -', '  - a2', '- b'])
    expect(result.path).toEqual([0, 1])
  })

  it('adds a root to an empty tree', () => {
    const result = insertSibling([], [], 'below')
    expect(text(result.roots)).toEqual(['-'])
    expect(result.path).toEqual([0])
  })

  it('does not change the input', () => {
    insertSibling(base, [0], 'below')
    expect(text(base)).toEqual(['- a', '  - a1', '  - a2', '- b'])
  })
})

describe('appendChild', () => {
  it('adds the last child and opens a folded parent', () => {
    const folded = toggleCollapsed(base, [0]).roots
    const result = appendChild(folded, [0])
    expect(text(result.roots)).toEqual(['- a', '  - a1', '  - a2', '  -', '- b'])
    expect(result.path).toEqual([0, 2])
    expect(result.roots[0]?.collapsed).toBe(false)
  })
})

describe('removeNode', () => {
  it('removes the subtree and selects the next sibling', () => {
    const result = removeNode(base, [0])
    expect(text(result.roots)).toEqual(['- b'])
    expect(result.path).toEqual([0])
    expect(result.removed && text([result.removed])).toEqual(['- a', '  - a1', '  - a2'])
  })

  it('selects the previous sibling when removing the last one', () => {
    expect(removeNode(base, [0, 1]).path).toEqual([0, 0])
  })

  it('selects the parent when removing the only child', () => {
    const result = removeNode(tree('- a', '  - b'), [0, 0])
    expect(result.path).toEqual([0])
  })

  it('selects nothing when the tree becomes empty', () => {
    expect(removeNode(tree('- a'), [0]).path).toBeNull()
  })
})

describe('indentNode / outdentNode', () => {
  it('moves the node under the previous sibling', () => {
    const result = indentNode(base, [1])
    expect(result && text(result.roots)).toEqual(['- a', '  - a1', '  - a2', '  - b'])
    expect(result?.path).toEqual([0, 2])
  })

  it('does nothing without a previous sibling', () => {
    expect(indentNode(base, [0])).toBeNull()
  })

  it('moves the node right after its parent', () => {
    const result = outdentNode(base, [0, 0])
    expect(result && text(result.roots)).toEqual(['- a', '  - a2', '- a1', '- b'])
    expect(result?.path).toEqual([1])
  })

  it('does nothing for a root', () => {
    expect(outdentNode(base, [0])).toBeNull()
  })
})

describe('swapNode', () => {
  it('swaps whole subtrees', () => {
    const result = swapNode(base, [0], 'down')
    expect(result && text(result.roots)).toEqual(['- b', '- a', '  - a1', '  - a2'])
    expect(result?.path).toEqual([1])
  })

  it('does nothing at the edge', () => {
    expect(swapNode(base, [0], 'up')).toBeNull()
  })
})

describe('visiblePaths', () => {
  it('skips the children of folded nodes', () => {
    const folded = toggleCollapsed(base, [0]).roots
    expect(visiblePaths(folded)).toEqual([[0], [1]])
    expect(visiblePaths(base)).toEqual([[0], [0, 0], [0, 1], [1]])
  })
})

describe('sameDepthNeighbor', () => {
  const cousins = tree('- a', '  - a1', '    - x', '  - a2', '- b', '  - b1')

  it('moves to the next sibling first', () => {
    expect(sameDepthNeighbor(cousins, [0, 0], 'down')).toEqual([0, 1])
  })

  it('crosses the parent to a cousin at the same depth', () => {
    expect(sameDepthNeighbor(cousins, [0, 1], 'down')).toEqual([1, 0])
    expect(sameDepthNeighbor(cousins, [1, 0], 'up')).toEqual([0, 1])
  })

  it('skips nodes hidden by a fold', () => {
    const folded = toggleCollapsed(cousins, [1]).roots
    expect(sameDepthNeighbor(folded, [0, 1], 'down')).toBeNull()
  })

  it('stops at the edge', () => {
    expect(sameDepthNeighbor(cousins, [0], 'up')).toBeNull()
    expect(sameDepthNeighbor(cousins, [0, 0, 0], 'down')).toBeNull()
  })
})

describe('clampPath', () => {
  it('moves a missing path to the nearest node', () => {
    expect(clampPath(base, [0, 5])).toEqual([0, 1])
    expect(clampPath(base, [7])).toEqual([1])
    expect(clampPath([], [0])).toBeNull()
  })
})
