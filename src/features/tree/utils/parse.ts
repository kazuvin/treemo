import type { StrayLine, TreeBlock, TreeNode } from '../types/tree'

const OPEN_FENCE = /^(`{3,}|~{3,})tree(\s.*)?$/
const NODE_LINE = /^(\s*)[-*+](?:( +)(.*))?$/
const TAB_WIDTH = 4

/** 続き行が `- ` で始まると子ノードと読まれてしまうので、書き戻しで `\` を足してある */
const ESCAPED_MARKER = /^\\+[-*+](\s|$)/

function expandTabs(line: string): string {
  const indent = /^[\t ]*/.exec(line)?.[0] ?? ''
  if (!indent.includes('\t')) {
    return line
  }
  let width = 0
  for (const ch of indent) {
    width = ch === '\t' ? width + TAB_WIDTH - (width % TAB_WIDTH) : width + 1
  }
  return ' '.repeat(width) + line.slice(indent.length)
}

function indentOf(line: string): number {
  return /^ */.exec(line)?.[0].length ?? 0
}

function unescapeContentLine(line: string): string {
  return ESCAPED_MARKER.test(line) ? line.slice(1) : line
}

interface Open {
  node: TreeNode
  indent: number
  contentCol: number
}

/** ブロックの中身（フェンスを除いた行）をノードに読む */
export function parseNodes(
  lines: readonly string[],
  lineOffset = 0,
): { roots: TreeNode[]; strayLines: StrayLine[] } {
  const roots: TreeNode[] = []
  const strayLines: StrayLine[] = []
  const stack: Open[] = []
  let last: Open | null = null

  lines.forEach((raw, i) => {
    const line = expandTabs(raw).trimEnd()
    if (line === '') {
      return
    }
    const match = NODE_LINE.exec(line)
    if (match) {
      const indent = match[1]?.length ?? 0
      const spaces = match[2]?.length ?? 1
      const node: TreeNode = { id: '', content: match[3] ?? '', children: [], line: i + lineOffset }
      while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) {
        stack.pop()
      }
      const parent = stack.at(-1)
      if (parent) {
        parent.node.children.push(node)
      } else {
        roots.push(node)
      }
      last = { node, indent, contentCol: indent + 1 + spaces }
      stack.push(last)
      return
    }
    if (last && indentOf(line) >= last.contentCol) {
      const rest = unescapeContentLine(line.slice(last.contentCol))
      last.node.content = `${last.node.content}\n${rest}`
      return
    }
    strayLines.push({ line: i + lineOffset, text: raw })
  })

  assignIds(roots, '')
  return { roots, strayLines }
}

export function assignIds(nodes: TreeNode[], prefix: string): void {
  nodes.forEach((node, i) => {
    node.id = prefix ? `${prefix}.${i}` : String(i)
    assignIds(node.children, node.id)
  })
}

/** 開始フェンスから終了フェンスまでを含むブロックの文字列を読む */
export function parseTreeBlock(source: string): TreeBlock | null {
  const lines = source.split('\n')
  const first = lines[0] ?? ''
  const open = OPEN_FENCE.exec(first)
  if (!open || lines.length < 2) {
    return null
  }
  const fence = open[1] ?? '```'
  const info = open[2] ?? ''
  const closing = lines.at(-1) ?? fence
  const { roots, strayLines } = parseNodes(lines.slice(1, -1), 1)
  return { fence, info, closing, roots, strayLines }
}
