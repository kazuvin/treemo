import type { Text } from '@codemirror/state'

export interface BlockRange {
  /** 開始フェンスの行頭 */
  from: number
  /** 終了フェンスの行末 */
  to: number
  source: string
}

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/
const TREE_INFO = /^tree(\s|$)/

/**
 * メモの中のツリーブロックを探す。閉じていないブロックは扱わない
 * （書いている途中でメモの残りが丸ごと絵になるのを避ける）。
 * 他のコードブロックの中の ```tree は拾わない。
 */
export function findTreeBlocks(doc: Text): BlockRange[] {
  const blocks: BlockRange[] = []
  let open: { char: string; length: number; from: number; tree: boolean } | null = null
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const match = FENCE.exec(line.text)
    if (!match) {
      continue
    }
    const indent = match[1] ?? ''
    const fence = match[2] ?? ''
    const rest = match[3] ?? ''
    if (open) {
      if (fence[0] === open.char && fence.length >= open.length && rest.trim() === '') {
        if (open.tree) {
          blocks.push({ from: open.from, to: line.to, source: doc.sliceString(open.from, line.to) })
        }
        open = null
      }
      continue
    }
    if (fence[0] === '`' && rest.includes('`')) {
      continue
    }
    open = {
      char: fence[0] ?? '`',
      length: fence.length,
      from: line.from,
      tree: indent === '' && TREE_INFO.test(rest),
    }
  }
  return blocks
}
