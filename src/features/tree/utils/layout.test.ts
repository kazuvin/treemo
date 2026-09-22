import type { TreeNode } from '../types/tree'
import { layoutTree, type Rect } from './layout'
import { toggleCollapsed } from './ops'
import { parseNodes } from './parse'

const options = { columnGap: 32, siblingGap: 8 }

function sizeOf(node: TreeNode) {
  return { width: 40 + node.content.length * 8, height: 20 * node.content.split('\n').length }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function check(roots: TreeNode[]) {
  const layout = layoutTree(roots, sizeOf, options)
  const rects = [...layout.rects.values()]
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(overlaps(rects[i]!, rects[j]!)).toBe(false)
    }
  }
  return layout
}

describe('layoutTree', () => {
  it('places children to the right of the parent', () => {
    const { roots } = parseNodes(['- root', '  - a', '  - b'])
    const layout = check(roots)
    const root = layout.rects.get('0')
    const a = layout.rects.get('0.0')
    expect(root && a && a.x).toBeGreaterThan((root?.x ?? 0) + (root?.width ?? 0))
  })

  it('centers the parent on its children', () => {
    const { roots } = parseNodes(['- root', '  - a', '  - b', '  - c'])
    const layout = check(roots)
    const root = layout.rects.get('0')
    const first = layout.rects.get('0.0')
    const last = layout.rects.get('0.2')
    if (!root || !first || !last) {
      throw new Error('missing rect')
    }
    const childrenCenter = (first.y + last.y + last.height) / 2
    expect(root.y + root.height / 2).toBeCloseTo(childrenCenter)
  })

  it('does not overlap nodes in deep, uneven trees', () => {
    const { roots } = parseNodes([
      '- 売上が落ちている',
      '  - 客数が減った',
      '    - 新規が減った',
      '      - 広告を止めた',
      '      - 紹介が減った',
      '        複数行',
      '    - リピートが減った',
      '  - 客単価が下がった',
      '    - 値引きが増えた',
      '- 別のルート',
      '  - x',
    ])
    const layout = check(roots)
    expect(layout.edges).toHaveLength(8)
  })

  it('packs a small subtree next to a tall one', () => {
    const { roots } = parseNodes(['- a', '  - a1', '    - x', '    - y', '    - z', '  - a2'])
    const layout = check(roots)
    const a1 = layout.rects.get('0.0')
    const a2 = layout.rects.get('0.1')
    if (!a1 || !a2) {
      throw new Error('missing rect')
    }
    expect(a2.y - (a1.y + a1.height)).toBeLessThan(60)
  })

  it('hides the children of folded nodes', () => {
    const { roots } = parseNodes(['- a', '  - b', '    - c'])
    const folded = toggleCollapsed(roots, [0, 0]).roots
    const layout = check(folded)
    expect([...layout.rects.keys()]).toEqual(['0', '0.0'])
    expect(layout.edges).toHaveLength(1)
  })

  it('draws elbow edges from the parent to the child', () => {
    const { roots } = parseNodes(['- a', '  - b'])
    const layout = check(roots)
    const edge = layout.edges[0]
    const a = layout.rects.get('0')
    const b = layout.rects.get('0.0')
    if (!edge || !a || !b) {
      throw new Error('missing edge')
    }
    expect(edge.points[0]).toEqual([a.x + a.width, a.y + a.height / 2])
    expect(edge.points.at(-1)).toEqual([b.x, b.y + b.height / 2])
  })
})
