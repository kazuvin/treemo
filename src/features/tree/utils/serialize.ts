import type { TreeBlock, TreeNode } from '../types/tree'

const INDENT = '  '
const NEEDS_ESCAPE = /^\\*[-*+](\s|$)/

/**
 * ノードの中身を書き戻せる形にそろえる。各行の末尾の空白と空行を除き、
 * 1 行目の先頭の空白も除く（どれも正規形では表せないため）。
 */
export function normalizeContent(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
  if (lines.length > 0) {
    lines[0] = (lines[0] ?? '').trimStart()
  }
  return lines.join('\n')
}

function escapeContentLine(line: string): string {
  return NEEDS_ESCAPE.test(line) ? `\\${line}` : line
}

/** 正規形（docs/tree-block.md の「書き戻し」）で書く */
export function serializeNodes(roots: readonly TreeNode[], depth = 0): string[] {
  const out: string[] = []
  const pad = INDENT.repeat(depth)
  for (const node of roots) {
    const [first = '', ...rest] = node.content.split('\n')
    out.push(first ? `${pad}- ${first}`.trimEnd() : `${pad}-`)
    for (const line of rest) {
      out.push(line ? `${pad}  ${escapeContentLine(line)}`.trimEnd() : '')
    }
    out.push(...serializeNodes(node.children, depth + 1))
  }
  return out
}

export function serializeTreeBlock(block: TreeBlock): string {
  return [`${block.fence}tree${block.info}`, ...serializeNodes(block.roots), block.closing].join(
    '\n',
  )
}
