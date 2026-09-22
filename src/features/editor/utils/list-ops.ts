/**
 * アウトライナーのリスト操作（F-EDIT-3）。行の配列を受け取り、置き換える行の範囲と
 * 新しい行を返す純粋な関数。行番号はすべて 0 始まり。
 */

const ITEM = /^(\s*)([-*+]|\d+[.)])(\s+|$)/
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/
const INDENT_UNIT = '  '

export interface LineEdit {
  /** 置き換える最初の行 */
  from: number
  /** 置き換える最後の行（含む） */
  to: number
  lines: string[]
  /** 操作のあとにカーソルを置く行 */
  cursorLine: number
}

function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function isItem(line: string): boolean {
  return ITEM.test(line)
}

interface ItemRange {
  start: number
  end: number
  indent: number
}

/** その行を含むリスト項目の、子を含めた範囲 */
export function listItemAt(lines: readonly string[], index: number): ItemRange | null {
  let start = index
  const line = lines[index]
  if (line === undefined) {
    return null
  }
  if (!isItem(line)) {
    if (isBlank(line)) {
      return null
    }
    const own = indentOf(line)
    start = -1
    for (let i = index - 1; i >= 0; i--) {
      const above = lines[i] ?? ''
      if (isBlank(above)) {
        continue
      }
      if (isItem(above) && indentOf(above) < own) {
        start = i
        break
      }
      if (indentOf(above) < own) {
        return null
      }
    }
    if (start === -1) {
      return null
    }
  }
  const indent = indentOf(lines[start] ?? '')
  let end = start
  for (let i = start + 1; i < lines.length; i++) {
    const below = lines[i] ?? ''
    if (isBlank(below)) {
      continue
    }
    if (indentOf(below) <= indent) {
      break
    }
    end = i
  }
  return { start, end, indent }
}

function siblingAbove(lines: readonly string[], item: ItemRange): ItemRange | null {
  for (let i = item.start - 1; i >= 0; i--) {
    const line = lines[i] ?? ''
    if (isBlank(line) || indentOf(line) > item.indent) {
      continue
    }
    if (indentOf(line) === item.indent && isItem(line)) {
      return listItemAt(lines, i)
    }
    return null
  }
  return null
}

function siblingBelow(lines: readonly string[], item: ItemRange): ItemRange | null {
  for (let i = item.end + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (isBlank(line)) {
      continue
    }
    if (indentOf(line) === item.indent && isItem(line)) {
      return listItemAt(lines, i)
    }
    return null
  }
  return null
}

export function indentItem(lines: readonly string[], index: number): LineEdit | null {
  const item = listItemAt(lines, index)
  if (!item) {
    return null
  }
  const out = lines
    .slice(item.start, item.end + 1)
    .map((line) => (isBlank(line) ? line : INDENT_UNIT + line))
  return { from: item.start, to: item.end, lines: out, cursorLine: index }
}

export function outdentItem(lines: readonly string[], index: number): LineEdit | null {
  const item = listItemAt(lines, index)
  if (!item || item.indent === 0) {
    return null
  }
  const remove = Math.min(INDENT_UNIT.length, item.indent)
  const out = lines
    .slice(item.start, item.end + 1)
    .map((line) => line.slice(Math.min(remove, indentOf(line))))
  return { from: item.start, to: item.end, lines: out, cursorLine: index }
}

export function moveItem(
  lines: readonly string[],
  index: number,
  direction: 'up' | 'down',
): LineEdit | null {
  const item = listItemAt(lines, index)
  if (!item) {
    return null
  }
  const other = direction === 'up' ? siblingAbove(lines, item) : siblingBelow(lines, item)
  if (!other) {
    return null
  }
  const [first, second] = direction === 'up' ? [other, item] : [item, other]
  const firstLines = lines.slice(first.start, first.end + 1)
  const between = lines.slice(first.end + 1, second.start)
  const secondLines = lines.slice(second.start, second.end + 1)
  const out = [...secondLines, ...between, ...firstLines]
  const offset = index - item.start
  const cursorLine =
    direction === 'up'
      ? first.start + offset
      : first.start + secondLines.length + between.length + offset
  return { from: first.start, to: second.end, lines: out, cursorLine }
}

/** チェックボックスを切り替える。リスト項目にチェックボックスが無ければ足す */
export function toggleTask(line: string): string | null {
  const task = TASK.exec(line)
  if (task) {
    const next = task[2] === ' ' ? 'x' : ' '
    return `${task[1]}${next}${task[3]}${line.slice(task[0].length)}`
  }
  const item = ITEM.exec(line)
  if (item) {
    const head = `${item[1]}${item[2]} `
    return `${head}[ ] ${line.slice(item[0].length)}`
  }
  return null
}
