import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Extension, StateField, type Transaction } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { isReading, readingChanged } from '@/lib/reading'
import { frontMatterField } from './front-matter'
import { INLINE_CLASSES } from './live-preview'

/** @lezer/common を依存に足さずに、構文木のノードの型を使う */
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolve']>

type Align = 'left' | 'center' | 'right' | null

/** セルの中身。文字か、ライブプレビューと同じクラスを付けた入れ子 */
type Inline = string | { className: string; children: Inline[] }

interface TableData {
  aligns: Align[]
  header: Inline[][]
  rows: Inline[][][]
}

interface TableRange {
  from: number
  to: number
}

/** 表の中で隠す記号。リンクは文字だけを残す */
const HIDDEN = new Set(['EmphasisMark', 'StrikethroughMark', 'LinkMark', 'CodeMark', 'LinkTitle'])

function text(state: EditorState, from: number, to: number): string {
  return state.doc.sliceString(from, to).replaceAll('\\|', '|')
}

function inline(state: EditorState, node: SyntaxNode, from: number, to: number): Inline[] {
  const out: Inline[] = []
  let pos = from
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) {
      out.push(text(state, pos, child.from))
    }
    const className = INLINE_CLASSES[child.name]
    if (className) {
      out.push({ className, children: inline(state, child, child.from, child.to) })
    } else if (child.name === 'Escape') {
      out.push(text(state, child.from + 1, child.to))
    } else if (!HIDDEN.has(child.name) && !(child.name === 'URL' && node.name === 'Link')) {
      out.push(...inline(state, child, child.from, child.to))
    }
    pos = child.to
  }
  if (to > pos) {
    out.push(text(state, pos, to))
  }
  return out
}

/** 行の `|` の位置で区切ったセルの範囲。空のセルには TableCell が無いので、区切りから数える */
function cellRanges(state: EditorState, row: SyntaxNode): TableRange[] {
  const line = state.doc.lineAt(row.from)
  const pipes: number[] = []
  if (row.name === 'TableDelimiter') {
    // 区切りの行は 1 つのノードで、中の `|` はノードにならない
    for (const match of line.text.matchAll(/\|/g)) {
      pipes.push(line.from + match.index)
    }
  }
  for (let child = row.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableDelimiter') {
      pipes.push(child.from)
    }
  }
  const starts = [line.from, ...pipes.map((p) => p + 1)]
  const ends = [...pipes, line.to]
  const ranges = starts.map((from, i) => ({ from, to: ends[i] ?? line.to }))
  const blank = (r: TableRange | undefined) =>
    r !== undefined && !state.doc.sliceString(r.from, r.to).trim()
  if (pipes.length > 0 && blank(ranges[0])) {
    ranges.shift()
  }
  if (pipes.length > 0 && blank(ranges.at(-1))) {
    ranges.pop()
  }
  return ranges
}

function cells(state: EditorState, row: SyntaxNode): Inline[][] {
  const nodes: SyntaxNode[] = []
  for (let child = row.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableCell') {
      nodes.push(child)
    }
  }
  return cellRanges(state, row).map((range) => {
    const node = nodes.find((n) => n.from >= range.from && n.to <= range.to)
    return node ? inline(state, node, node.from, node.to) : []
  })
}

function alignOf(cell: string): Align {
  const spec = cell.trim()
  const left = spec.startsWith(':')
  const right = spec.endsWith(':')
  if (left && right) {
    return 'center'
  }
  if (right) {
    return 'right'
  }
  return left ? 'left' : null
}

/** GFM の表を読む。列の数は見出しの行に合わせ、足りないセルは空にし、余るセルは捨てる */
function readTable(state: EditorState, table: SyntaxNode): TableData {
  let header: Inline[][] = []
  let aligns: Align[] = []
  const rows: Inline[][][] = []
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') {
      header = cells(state, child)
    } else if (child.name === 'TableDelimiter') {
      aligns = cellRanges(state, child).map((r) => alignOf(state.doc.sliceString(r.from, r.to)))
    } else if (child.name === 'TableRow') {
      rows.push(cells(state, child))
    }
  }
  const fit = (row: Inline[][]) => header.map((_, i) => row[i] ?? [])
  return {
    aligns: header.map((_, i) => aligns[i] ?? null),
    header,
    rows: rows.map(fit),
  }
}

function append(parent: HTMLElement, content: Inline[]): void {
  for (const part of content) {
    if (typeof part === 'string') {
      parent.append(part)
    } else {
      const span = document.createElement('span')
      span.className = part.className
      append(span, part.children)
      parent.append(span)
    }
  }
}

class TableWidget extends WidgetType {
  constructor(
    readonly data: TableData,
    readonly source: string,
  ) {
    super()
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-table'
    const scroll = document.createElement('div')
    scroll.className = 'cm-table-scroll'
    const table = document.createElement('table')
    const addRow = (section: HTMLTableSectionElement, row: Inline[][], tag: 'th' | 'td') => {
      const tr = section.insertRow()
      row.forEach((content, i) => {
        const cell = document.createElement(tag)
        const align = this.data.aligns[i]
        if (align) {
          cell.style.textAlign = align
        }
        const inner = document.createElement('div')
        inner.className = 'cm-table-cell'
        append(inner, content)
        cell.append(inner)
        tr.append(cell)
      })
    }
    addRow(table.createTHead(), this.data.header, 'th')
    const body = table.createTBody()
    for (const row of this.data.rows) {
      addRow(body, row, 'td')
    }
    // 横のスクロールバーを掴んだときにソースへ戻らないよう、押したのが表のときだけ入る
    table.addEventListener('mousedown', (event) => {
      event.preventDefault()
      if (isReading(view.state)) {
        return
      }
      view.dispatch({ selection: { anchor: view.posAtDOM(root) } })
      view.focus()
    })
    scroll.append(table)
    root.append(scroll)
    return root
  }

  override ignoreEvent(): boolean {
    return true
  }
}

/** 表のノード。構文木が変わるたびに探し直すので、いまの構文木のもの */
function findTables(state: EditorState): SyntaxNode[] {
  const bodyFrom = (state.field(frontMatterField, false)?.to ?? -1) + 1
  const tables: SyntaxNode[] = []
  const cursor = syntaxTree(state).cursor()
  if (!cursor.firstChild()) {
    return tables
  }
  do {
    if (cursor.name === 'Table' && cursor.from >= bodyFrom) {
      tables.push(cursor.node)
    }
  } while (cursor.nextSibling())
  return tables
}

function treeChanged(tr: Transaction): boolean {
  return syntaxTree(tr.startState) !== syntaxTree(tr.state)
}

const tablesField = StateField.define<SyntaxNode[]>({
  create: findTables,
  update: (value, tr) => (tr.docChanged || treeChanged(tr) ? findTables(tr.state) : value),
})

function touches(state: EditorState, range: SyntaxNode): boolean {
  if (isReading(state)) {
    return false
  }
  return state.selection.ranges.some((r) => r.from <= range.to && r.to >= range.from)
}

function build(state: EditorState): DecorationSet {
  const widgets = state
    .field(tablesField)
    .filter((node) => !touches(state, node))
    .map((node) => {
      const widget = new TableWidget(
        readTable(state, node),
        state.doc.sliceString(node.from, node.to),
      )
      return Decoration.replace({ widget, block: true }).range(node.from, node.to)
    })
  return Decoration.set(widgets)
}

const decorations = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) =>
    tr.docChanged || tr.selection || tr.reconfigured || readingChanged(tr) || treeChanged(tr)
      ? build(tr.state)
      : value,
  provide: (field) => EditorView.decorations.from(field),
})

const theme = EditorView.theme({
  // 表を本文の幅より広げるときに、エディタの幅（cqw）を知るため
  '.cm-scroller': { containerType: 'inline-size' },
  // 本文の列から左右へエディタの端まで張り出し、表を中央に置く。表が本文の幅に収まる
  // あいだは、左端を本文にそろえる
  '.cm-table': {
    display: 'flex',
    justifyContent: 'center',
    width: '100cqw',
    marginLeft: 'calc(50% - 50cqw)',
    paddingTop: 'var(--spacing-gap)',
    whiteSpace: 'normal',
    cursor: 'text',
  },
  '.cm-table-scroll': {
    boxSizing: 'border-box',
    // base.ts の .cm-content の最大幅と同じ
    minWidth: 'min(80ch, 100%)',
    maxWidth: '100%',
    overflowX: 'auto',
    // 下の余白はスクロールの内側に取り、macOS の重なるスクロールバーが最後の行に掛からないようにする
    padding: '0 var(--spacing-edge-h) var(--spacing-gap)',
  },
  '.cm-table table': {
    width: 'max-content',
    borderCollapse: 'collapse',
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
  },
  '.cm-table th, .cm-table td': {
    padding: 'var(--spacing-gap-tight) var(--spacing-gap)',
    borderBottom: '1px solid var(--color-border-hairline)',
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '.cm-table th': {
    borderTop: '1px solid var(--color-border-hairline)',
    borderBottomColor: 'var(--color-border)',
    fontWeight: 'var(--font-weight-semibold)',
  },
  // 長い文のセルで表が横に伸び続けないよう、セルの中で折り返す
  '.cm-table-cell': { maxWidth: '40ch', overflowWrap: 'anywhere' },
})

/** GFM の表を、カーソルが外にあるあいだ表にして見せる（F-EDIT-8） */
export function markdownTable(): Extension {
  return [tablesField, decorations, theme]
}
