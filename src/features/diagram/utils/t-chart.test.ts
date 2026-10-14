import { Text } from '@codemirror/state'
import type { TreeNode } from '../types/tree'
import { findTreeBlocks } from './find-blocks'
import { edgePath, layoutTChart, type Rect } from './layout'
import { toggleCollapsed } from './ops'
import { parseTreeBlock } from './parse'
import { serializeTreeBlock } from './serialize'
import { armOfQuestion, EMPTY_TCHART, tchartAllows, tchartMove } from './t-chart'

interface Shape {
  content: string
  children: Shape[]
}

function shape(nodes: readonly TreeNode[]): Shape[] {
  return nodes.map((node) => ({ content: node.content, children: shape(node.children) }))
}

function n(content: string, ...children: Shape[]): Shape {
  return { content, children }
}

function parse(source: string) {
  const block = parseTreeBlock(source)
  if (!block) {
    throw new Error('not a block')
  }
  return block
}

const EXAMPLE = [
  '```tchart',
  '- 仕事がつまらない',
  '  - なぜ？',
  '    - 毎日同じ作業だから',
  '      - 任される範囲が狭いから',
  '    - 評価が見えないから',
  '  - それで？',
  '    - 新しい仕事に手を挙げたい',
  '  - 本当に？',
  '    - 先月の企画は楽しかった',
  '```',
].join('\n')

describe('parseTreeBlock for tchart', () => {
  it('reads the example from docs/t-chart.md', () => {
    const block = parse(EXAMPLE)
    expect(block.kind).toBe('tchart')
    expect(block.strayLines).toEqual([])
    expect(shape(block.roots)).toEqual([
      n(
        '仕事がつまらない',
        n('なぜ？', n('毎日同じ作業だから', n('任される範囲が狭いから')), n('評価が見えないから')),
        n('それで？', n('新しい仕事に手を挙げたい')),
        n('本当に？', n('先月の企画は楽しかった')),
      ),
    ])
    expect(block.roots[0]?.children.map((q) => q.id)).toEqual(['0.0', '0.1', '0.2'])
  })

  it('writes the example back unchanged', () => {
    expect(serializeTreeBlock(parse(EXAMPLE))).toBe(EXAMPLE)
  })

  it('adds missing questions and puts them in the fixed order', () => {
    const block = parse('```tchart\n- 中心\n  - 本当に?\n    - a\n  - なぜ\n```')
    expect(block.strayLines).toEqual([])
    expect(shape(block.roots)).toEqual([
      n('中心', n('なぜ？'), n('それで？'), n('本当に？', n('a'))),
    ])
    expect(serializeTreeBlock(block)).toBe(
      '```tchart\n- 中心\n  - なぜ？\n  - それで？\n  - 本当に？\n    - a\n```',
    )
  })

  it('merges answers of a question written twice', () => {
    const block = parse('```tchart\n- 中心\n  - なぜ？\n    - a\n  - なぜ？\n    - b\n```')
    expect(shape(block.roots[0]?.children ?? [])[0]).toEqual(n('なぜ？', n('a'), n('b')))
  })

  it('makes the center and the questions for an empty block', () => {
    const block = parse('```tchart\n```')
    expect(block.strayLines).toEqual([])
    expect(shape(block.roots)).toEqual([n('', n('なぜ？'), n('それで？'), n('本当に？'))])
    expect(serializeTreeBlock(block)).toBe(EMPTY_TCHART)
  })

  it('marks answers outside the questions and extra roots as stray', () => {
    const block = parse('```tchart\n- 中心\n  - 答え\n    - 子\n  - なぜ？\n- もう 1 つ\n```')
    expect(block.strayLines).toEqual([
      { line: 2, text: '  - 答え' },
      { line: 3, text: '    - 子' },
      { line: 5, text: '- もう 1 つ' },
    ])
    expect(shape(block.roots)).toEqual([n('中心', n('なぜ？'), n('それで？'), n('本当に？'))])
  })

  it('keeps the info string', () => {
    expect(serializeTreeBlock(parse('~~~~tchart foo=1\n- a\n~~~~'))).toBe(
      '~~~~tchart foo=1\n- a\n  - なぜ？\n  - それで？\n  - 本当に？\n~~~~',
    )
  })

  it('is found next to tree blocks', () => {
    const doc = Text.of(['```tchart', '- a', '```', '```tree', '- b', '```', '```tchartx', '```'])
    expect(findTreeBlocks(doc).map((b) => b.source.split('\n')[0])).toEqual([
      '```tchart',
      '```tree',
    ])
  })
})

describe('armOfQuestion', () => {
  it('reads the questions with or without the question mark', () => {
    expect(armOfQuestion('なぜ？')).toBe(0)
    expect(armOfQuestion(' それで? ')).toBe(1)
    expect(armOfQuestion('本当に')).toBe(2)
    expect(armOfQuestion('なぜなら')).toBe(-1)
  })
})

describe('tchartMove', () => {
  it('goes from the center to the question in the pressed direction', () => {
    expect(tchartMove([0], 'down')).toEqual([0, 0])
    expect(tchartMove([0], 'right')).toEqual([0, 1])
    expect(tchartMove([0], 'left')).toEqual([0, 2])
    expect(tchartMove([0], 'up')).toBeNull()
  })

  it('moves along each arm in its own direction', () => {
    expect(tchartMove([0, 0], 'up')).toBe('parent')
    expect(tchartMove([0, 0, 1], 'down')).toBe('child')
    expect(tchartMove([0, 0, 1], 'right')).toBe('next')
    expect(tchartMove([0, 1, 0], 'right')).toBe('child')
    expect(tchartMove([0, 1, 0], 'down')).toBe('next')
    expect(tchartMove([0, 2], 'right')).toBe('parent')
    expect(tchartMove([0, 2, 0], 'left')).toBe('child')
  })

  it('does not move between questions as siblings', () => {
    expect(tchartMove([0, 1], 'down')).toBeNull()
    expect(tchartMove([0, 0], 'right')).toBeNull()
  })
})

describe('tchartAllows', () => {
  it('keeps the center and the questions in place', () => {
    expect(tchartAllows('reshape', [0])).toBe(false)
    expect(tchartAllows('reshape', [0, 1])).toBe(false)
    expect(tchartAllows('reshape', [0, 1, 0])).toBe(true)
    expect(tchartAllows('grow', [0])).toBe(false)
    expect(tchartAllows('grow', [0, 1])).toBe(true)
    expect(tchartAllows('edit', [0])).toBe(true)
    expect(tchartAllows('edit', [0, 1])).toBe(false)
    expect(tchartAllows('fold', [0])).toBe(false)
  })

  it('outdents only answers below another answer', () => {
    expect(tchartAllows('outdent', [0, 0, 0])).toBe(false)
    expect(tchartAllows('outdent', [0, 0, 0, 0])).toBe(true)
  })
})

describe('layoutTChart', () => {
  const options = {
    stemGap: 16,
    side: { columnGap: 32, siblingGap: 8 },
    down: { columnGap: 32, siblingGap: 16 },
    armGap: 24,
    margin: 40,
  }

  function sizeOf(node: TreeNode) {
    return { width: 40 + node.content.length * 8, height: 20 * node.content.split('\n').length }
  }

  function overlaps(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    )
  }

  function check(source: string) {
    const roots = parse(source).roots
    const layout = layoutTChart(roots, sizeOf, options)
    const rects = [...layout.rects.values()]
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false)
      }
    }
    const get = (id: string) => {
      const rect = layout.rects.get(id)
      if (!rect) {
        throw new Error(`no rect for ${id}`)
      }
      return rect
    }
    return { layout, get, roots }
  }

  const middleY = (r: Rect) => r.y + r.height / 2
  const middleX = (r: Rect) => r.x + r.width / 2

  it('puts なぜ？ below, それで？ right and 本当に？ left of the center', () => {
    const { get } = check(EXAMPLE)
    const center = get('0')
    const why = get('0.0')
    const so = get('0.1')
    const really = get('0.2')
    expect(why.y).toBeGreaterThan(center.y + center.height)
    expect(middleX(why)).toBe(middleX(center))
    expect(so.x).toBe(center.x + center.width + options.stemGap)
    expect(middleY(so)).toBe(middleY(center))
    expect(really.x + really.width).toBe(center.x - options.stemGap)
    expect(middleY(really)).toBe(middleY(center))
  })

  it('grows each arm away from the center', () => {
    const { get } = check(EXAMPLE)
    expect(get('0.0.0').y).toBeGreaterThan(get('0.0').y)
    expect(get('0.0.0.0').y).toBeGreaterThan(get('0.0.0').y)
    expect(get('0.0.1').x).toBeGreaterThan(get('0.0.0').x)
    expect(get('0.1.0').x).toBeGreaterThan(get('0.1').x + get('0.1').width)
    expect(get('0.2.0').x + get('0.2.0').width).toBeLessThan(get('0.2').x)
  })

  it('leaves the margin on the left, right and bottom', () => {
    const { layout } = check(EXAMPLE)
    const rects = [...layout.rects.values()]
    expect(Math.min(...rects.map((r) => r.x))).toBe(options.margin)
    expect(Math.min(...rects.map((r) => r.y))).toBe(0)
    expect(Math.max(...rects.map((r) => r.x + r.width))).toBe(layout.width - options.margin)
    expect(Math.max(...rects.map((r) => r.y + r.height))).toBe(layout.height - options.margin)
  })

  it('lowers a wide なぜ？ arm below the side arms', () => {
    const answers = ['a', 'b', 'c', 'd', 'e'].map((s) => `    - 長い答え ${s}`)
    const side = ['x', 'y', 'z'].map((s) => `    - 横 ${s}`)
    const source = [
      '```tchart',
      '- 中心',
      '  - なぜ？',
      ...answers,
      '  - それで？',
      ...side,
      '  - 本当に？',
      ...side,
      '```',
    ].join('\n')
    const { get } = check(source)
    const sideBottom = Math.max(...[0, 1, 2].map((i) => get(`0.1.${i}`).y + get(`0.1.${i}`).height))
    expect(get('0.0').y).toBe(sideBottom + options.armGap)
  })

  it('draws edges in the direction of each arm', () => {
    const { layout } = check(EXAMPLE)
    const flows = Object.fromEntries(layout.edges.map((e) => [`${e.from}>${e.to}`, e.flow]))
    expect(flows['0>0.0']).toBe('tb')
    expect(flows['0.0>0.0.0']).toBe('tb')
    expect(flows['0>0.1']).toBe('lr')
    expect(flows['0.2>0.2.0']).toBe('rl')
  })

  it('hides a folded arm', () => {
    const roots = parse(EXAMPLE).roots
    const folded = toggleCollapsed(roots, [0, 0]).roots
    const layout = layoutTChart(folded, sizeOf, options)
    expect(layout.rects.has('0.0')).toBe(true)
    expect(layout.rects.has('0.0.0')).toBe(false)
  })
})

describe('edgePath', () => {
  it('draws right-to-left edges from the left side of the parent', () => {
    const parent = { x: 100, y: 0, width: 40, height: 20 }
    const child = { x: 20, y: 40, width: 40, height: 20 }
    expect(edgePath(parent, child, 'rl')).toBe('M100,10 C80,10 80,50 60,50')
  })
})
