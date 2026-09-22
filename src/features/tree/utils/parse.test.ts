import { Text } from '@codemirror/state'
import type { TreeNode } from '../types/tree'
import { findTreeBlocks } from './find-blocks'
import { parseNodes, parseTreeBlock } from './parse'
import { normalizeContent, serializeNodes, serializeTreeBlock } from './serialize'

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

function toNodes(shapes: readonly Shape[]): TreeNode[] {
  return shapes.map((s) => ({ id: '', content: s.content, children: toNodes(s.children) }))
}

describe('parseNodes', () => {
  it('reads the example from docs/tree-block.md', () => {
    const lines = [
      '- 売上が落ちている',
      '  - 客数が減った',
      '    - 新規が減った',
      '    - リピートが減った',
      '  - 客単価が下がった',
      '    - **値引き**が増えた',
      '      セール期間が 2 週から 4 週に延びた',
    ]
    const { roots, strayLines } = parseNodes(lines)
    expect(strayLines).toEqual([])
    expect(shape(roots)).toEqual([
      n(
        '売上が落ちている',
        n('客数が減った', n('新規が減った'), n('リピートが減った')),
        n('客単価が下がった', n('**値引き**が増えた\nセール期間が 2 週から 4 週に延びた')),
      ),
    ])
  })

  it('reads several roots', () => {
    expect(shape(parseNodes(['- a', '- b']).roots)).toEqual([n('a'), n('b')])
  })

  it('accepts * and + markers', () => {
    expect(shape(parseNodes(['* a', '  + b']).roots)).toEqual([n('a', n('b'))])
  })

  it('treats a jump of several levels as a child of the previous node', () => {
    expect(shape(parseNodes(['- a', '        - b', '  - c']).roots)).toEqual([
      n('a', n('b'), n('c')),
    ])
  })

  it('skips blank lines', () => {
    expect(shape(parseNodes(['- a', '', '  - b']).roots)).toEqual([n('a', n('b'))])
  })

  it('reports lines before the first node as stray', () => {
    const { strayLines } = parseNodes(['intro', '- a'], 1)
    expect(strayLines).toEqual([{ line: 1, text: 'intro' }])
  })

  it('reports lines that do not continue any node as stray', () => {
    const { roots, strayLines } = parseNodes(['- a', '  - b', '  not enough'])
    expect(shape(roots)).toEqual([n('a', n('b'))])
    expect(strayLines).toEqual([{ line: 2, text: '  not enough' }])
  })

  it('reads empty nodes', () => {
    expect(shape(parseNodes(['-', '  -']).roots)).toEqual([n('', n(''))])
  })

  it('assigns ids from the path', () => {
    const { roots } = parseNodes(['- a', '  - b', '- c'])
    expect(roots.map((r) => r.id)).toEqual(['0', '1'])
    expect(roots[0]?.children[0]?.id).toBe('0.0')
  })

  it('unescapes continuation lines that look like markers', () => {
    expect(shape(parseNodes(['- a', '  \\- not a child']).roots)).toEqual([n('a\n- not a child')])
  })
})

describe('parseTreeBlock', () => {
  it('keeps the fence, info string and closing line', () => {
    const block = parseTreeBlock('~~~~tree layout=lr x\n- a\n~~~~~')
    expect(block?.fence).toBe('~~~~')
    expect(block?.info).toBe(' layout=lr x')
    expect(block?.closing).toBe('~~~~~')
    expect(block && serializeTreeBlock(block)).toBe('~~~~tree layout=lr x\n- a\n~~~~~')
  })

  it('reads an empty block', () => {
    const block = parseTreeBlock('```tree\n```')
    expect(block?.roots).toEqual([])
    expect(block && serializeTreeBlock(block)).toBe('```tree\n```')
  })

  it('rejects other code blocks', () => {
    expect(parseTreeBlock('```ts\nx\n```')).toBeNull()
    expect(parseTreeBlock('```treemap\nx\n```')).toBeNull()
  })
})

describe('serializeNodes', () => {
  it('writes the canonical form', () => {
    const roots = toNodes([n('a', n('b\nmore', n('')), n('c')), n('d')])
    expect(serializeNodes(roots)).toEqual(['- a', '  - b', '    more', '    -', '  - c', '- d'])
  })

  it('escapes continuation lines that would read as nodes', () => {
    const roots = toNodes([n('a\n- x\n\\- y')])
    expect(serializeNodes(roots)).toEqual(['- a', '  \\- x', '  \\\\- y'])
  })
})

describe('round trip', () => {
  function randomTree(seed: number): Shape[] {
    let s = seed
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
    const words = ['a', '**b**', '`c`', '- d', '\\- e', '[f](g)', 'ｈ', '* i', '']
    const make = (depth: number): Shape[] => {
      const count = depth === 0 ? 1 + Math.floor(rand() * 3) : Math.floor(rand() * 3)
      return Array.from({ length: depth > 3 ? 0 : count }, () => {
        const lines = Array.from(
          { length: 1 + Math.floor(rand() * 3) },
          () => words[Math.floor(rand() * words.length)] ?? '',
        )
        return n(normalizeContent(lines.join('\n')), ...make(depth + 1))
      })
    }
    return make(0)
  }

  it('parse(serialize(T)) has the same shape as T', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const tree = randomTree(seed)
      const lines = serializeNodes(toNodes(tree))
      expect(shape(parseNodes(lines).roots)).toEqual(tree)
    }
  })

  it('serialize(parse(s)) equals a canonical string s', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = serializeNodes(toNodes(randomTree(seed)))
      expect(serializeNodes(parseNodes(s).roots)).toEqual(s)
    }
  })
})

describe('normalizeContent', () => {
  it('removes blank lines and outer whitespace', () => {
    expect(normalizeContent('  a  \n\n  b \n')).toBe('a\n  b')
  })
})

describe('findTreeBlocks', () => {
  it('finds closed tree blocks with their ranges', () => {
    const doc = Text.of(['# t', '```tree', '- a', '```', 'after'])
    const blocks = findTreeBlocks(doc)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.source).toBe('```tree\n- a\n```')
    expect(blocks[0]?.from).toBe(doc.line(2).from)
    expect(blocks[0]?.to).toBe(doc.line(4).to)
  })

  it('ignores tree fences inside other code blocks', () => {
    const doc = Text.of(['````markdown', '```tree', '- a', '```', '````'])
    expect(findTreeBlocks(doc)).toEqual([])
  })

  it('ignores unclosed blocks and other languages', () => {
    expect(findTreeBlocks(Text.of(['```ts', '```', '```tree', '- a']))).toEqual([])
  })

  it('needs a closing fence at least as long as the opening one', () => {
    const doc = Text.of(['````tree', '- a', '```', '- b', '````'])
    expect(findTreeBlocks(doc)[0]?.source).toBe('````tree\n- a\n```\n- b\n````')
  })
})
