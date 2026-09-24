import type { TreeNode } from '../types/tree'
import { edgePath, layoutTree, type Rect } from './layout'
import { toggleCollapsed } from './ops'
import { parseNodes } from './parse'

const options = { columnGap: 32, siblingGap: 8 }

function sizeOf(node: TreeNode) {
  return { width: 40 + node.content.length * 8, height: 20 * node.content.split('\n').length }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function check(roots: TreeNode[], direction: 'lr' | 'tb' = 'lr') {
  const layout = layoutTree(roots, sizeOf, { ...options, direction })
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

  it('draws curved edges from the parent to the child', () => {
    const parent = { x: 0, y: 0, width: 40, height: 20 }
    const child = { x: 80, y: 40, width: 40, height: 20 }
    expect(edgePath(parent, child)).toBe('M40,10 C60,10 60,50 80,50')
  })

  it('places children below the parent when laid out top to bottom', () => {
    const { roots } = parseNodes(['- root', '  - a', '    - x', '    - y', '  - b'])
    const layout = check(roots, 'tb')
    const root = layout.rects.get('0')
    const a = layout.rects.get('0.0')
    const b = layout.rects.get('0.1')
    if (!root || !a || !b) {
      throw new Error('missing rect')
    }
    expect(a.y).toBeGreaterThan(root.y + root.height)
    expect(b.x).toBeGreaterThan(a.x + a.width)
    expect(a.y).toBe(b.y)
    expect(a.width).toBe(sizeOf(roots[0]!.children[0]!).width)
    for (const r of layout.rects.values()) {
      expect(r.x + r.width).toBeLessThanOrEqual(layout.width)
      expect(r.y + r.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('draws vertical edges when laid out top to bottom', () => {
    const parent = { x: 0, y: 0, width: 40, height: 20 }
    const child = { x: 60, y: 60, width: 40, height: 20 }
    expect(edgePath(parent, child, 'tb')).toBe('M20,20 C20,40 80,40 80,60')
  })
})
