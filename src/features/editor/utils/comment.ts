/**
 * Obsidian のコメント（`%%…%%`）。行をまたいでもよく、閉じの `%%` が無ければ文書の終わりまで。
 * コードブロックとインラインコードの中の `%%` は数えない
 */
export interface CommentRange {
  /** 開きの `%%` の頭 */
  from: number
  /** 閉じの `%%` の後ろ。閉じが無ければ文書の終わり */
  to: number
  closed: boolean
}

const MARK = '%%'
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** インラインコード（同じ長さのバッククォートで閉じる）の後ろの位置。閉じが無ければ null */
function codeSpanEnd(line: string, start: number): number | null {
  let ticks = 0
  while (line[start + ticks] === '`') {
    ticks++
  }
  const run = '`'.repeat(ticks)
  let i = line.indexOf(run, start + ticks)
  while (i !== -1) {
    let len = 0
    while (line[i + len] === '`') {
      len++
    }
    if (len === ticks) {
      return i + len
    }
    i = line.indexOf(run, i + len)
  }
  return null
}

export function findComments(text: string): CommentRange[] {
  if (!text.includes(MARK)) {
    return []
  }
  const out: CommentRange[] = []
  let open: number | null = null
  let fence: string | null = null
  let lineStart = 0
  for (const line of text.split('\n')) {
    if (open === null) {
      const fenceMark = FENCE.exec(line)?.[1]
      if (fence !== null) {
        if (
          fenceMark !== undefined &&
          fenceMark[0] === fence[0] &&
          fenceMark.length >= fence.length
        ) {
          fence = null
        }
        lineStart += line.length + 1
        continue
      }
      if (fenceMark) {
        fence = fenceMark
        lineStart += line.length + 1
        continue
      }
    }
    let i = 0
    while (i < line.length) {
      if (open === null && line[i] === '`') {
        const end = codeSpanEnd(line, i)
        if (end !== null) {
          i = end
          continue
        }
      }
      if (line.startsWith(MARK, i)) {
        if (open === null) {
          open = lineStart + i
        } else {
          out.push({ from: open, to: lineStart + i + MARK.length, closed: true })
          open = null
        }
        i += MARK.length
        continue
      }
      i++
    }
    lineStart += line.length + 1
  }
  if (open !== null) {
    out.push({ from: open, to: text.length, closed: false })
  }
  return out
}

/** pos を含む（両端も含む）コメント */
export function commentAt(comments: readonly CommentRange[], pos: number): CommentRange | null {
  let lo = 0
  let hi = comments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const c = comments[mid]
    if (!c) {
      break
    }
    if (pos < c.from) {
      hi = mid - 1
    } else if (pos > c.to) {
      lo = mid + 1
    } else {
      return c
    }
  }
  return null
}

export interface TextChange {
  from: number
  to: number
  insert: string
}

/** 字下げ・引用・リストの記号・チェックボックスの後ろ。コメントで囲むのはここから */
const LINE_PREFIX = /^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?)/

/**
 * コメントを付け外しする変更（Obsidian の「コメントを切り替える」）。
 * 範囲がコメントの中なら `%%` を外す。そうでなければ範囲を囲む。範囲が空ならその行の中身を囲む
 */
export function toggleComment(
  text: string,
  from: number,
  to: number,
): { changes: TextChange[]; cursor: number } {
  const comments = findComments(text)
  const around = commentAt(comments, from)
  if (around && to <= around.to) {
    const changes = [{ from: around.from, to: around.from + MARK.length, insert: '' }]
    if (around.closed) {
      changes.push({ from: around.to - MARK.length, to: around.to, insert: '' })
    }
    return { changes, cursor: Math.max(around.from, from - MARK.length) }
  }
  if (from === to) {
    const lineFrom = text.lastIndexOf('\n', from - 1) + 1
    const end = text.indexOf('\n', from)
    const lineTo = end === -1 ? text.length : end
    const line = text.slice(lineFrom, lineTo)
    const start = lineFrom + (LINE_PREFIX.exec(line)?.[1]?.length ?? 0)
    if (start === lineTo) {
      return { changes: [{ from: start, to: start, insert: '%%%%' }], cursor: start + MARK.length }
    }
    from = start
    to = lineTo
  }
  return {
    changes: [
      { from, to: from, insert: MARK },
      { from: to, to, insert: MARK },
    ],
    cursor: from + MARK.length,
  }
}
