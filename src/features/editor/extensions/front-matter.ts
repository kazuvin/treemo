import {
  type EditorState,
  type Extension,
  Facet,
  type Range,
  StateField,
  type Text,
} from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import {
  FRONT_MATTER_MAX_LINES,
  findFrontMatter,
  isTagKey,
  parseProperties,
  type Property,
  tagsOf,
} from '@/lib/front-matter'

export interface FrontMatterRange {
  /** 開きの `---` の行頭 */
  from: number
  /** 閉じの `---` の行末 */
  to: number
  /** 読めなければ null */
  properties: Property[] | null
}

function locate(doc: Text): FrontMatterRange | null {
  const close = findFrontMatter((i) => (i < doc.lines ? doc.line(i + 1).text : undefined))
  if (close === null) {
    return null
  }
  const closeLine = doc.line(close + 1)
  const yaml = close > 1 ? doc.sliceString(doc.line(2).from, doc.line(close).to) : ''
  return { from: 0, to: closeLine.to, properties: parseProperties(yaml) }
}

export const frontMatterField = StateField.define<FrontMatterRange | null>({
  create: (state) => locate(state.doc),
  update: (value, tr) => (tr.docChanged ? locate(tr.state.doc) : value),
})

/** メモを開いたときにカーソルを置く位置。フロントマターがあれば、その次の行の頭 */
export function bodyStart(doc: string): number {
  const lines = doc.split('\n', FRONT_MATTER_MAX_LINES + 1)
  const close = findFrontMatter((i) => lines[i])
  if (close === null) {
    return 0
  }
  let pos = 0
  for (let i = 0; i <= close; i++) {
    pos += (lines[i]?.length ?? 0) + 1
  }
  return Math.min(pos, doc.length)
}

/** タグを押したときに呼ぶもの。app がタグ検索を開く関数を渡す */
export const tagClickHandler = Facet.define<(tag: string) => void, ((tag: string) => void) | null>({
  combine: (values) => values[0] ?? null,
})

class PropertiesWidget extends WidgetType {
  constructor(
    readonly properties: Property[],
    readonly key: string,
  ) {
    super()
  }

  override eq(other: PropertiesWidget): boolean {
    return other.key === this.key
  }

  toDOM(view: EditorView): HTMLElement {
    const onTag = view.state.facet(tagClickHandler)
    const root = document.createElement('div')
    root.className = 'cm-fm'
    root.title = 'クリックかカーソルを乗せると YAML を編集できます'
    root.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({ selection: { anchor: 0 } })
      view.focus()
    })
    const table = document.createElement('table')
    for (const { key, value } of this.properties) {
      const row = table.insertRow()
      const keyCell = row.insertCell()
      keyCell.className = 'cm-fm-key'
      keyCell.textContent = key
      const valueCell = row.insertCell()
      valueCell.className = 'cm-fm-value'
      if (isTagKey(key) && value.kind !== 'empty' && value.kind !== 'boolean') {
        for (const tag of tagsOf([{ key, value }])) {
          valueCell.append(tagChip(tag, onTag))
        }
      } else if (value.kind === 'list') {
        for (const item of value.items) {
          valueCell.append(chip(item))
        }
      } else if (value.kind === 'boolean') {
        const box = document.createElement('span')
        box.className = value.value ? 'cm-lp-task cm-lp-task-done' : 'cm-lp-task'
        box.textContent = value.value ? '✓' : ''
        box.setAttribute('role', 'checkbox')
        box.setAttribute('aria-checked', String(value.value))
        valueCell.append(box)
      } else if (value.kind === 'empty') {
        valueCell.classList.add('cm-fm-empty')
        valueCell.textContent = '—'
      } else {
        valueCell.textContent = value.text
      }
    }
    root.append(table)
    return root
  }

  override ignoreEvent(): boolean {
    return true
  }
}

function chip(text: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'cm-fm-chip'
  span.textContent = text
  return span
}

function tagChip(tag: string, onTag: ((tag: string) => void) | null): HTMLElement {
  const span = chip(`#${tag}`)
  if (!onTag) {
    return span
  }
  span.classList.add('cm-fm-tag')
  span.dataset['hint'] = ''
  span.title = `#${tag} のメモを探す`
  span.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onTag(tag)
  })
  return span
}

function touches(state: EditorState, range: FrontMatterRange): boolean {
  return state.selection.ranges.some((r) => r.from <= range.to && r.to >= range.from)
}

const sourceLine = Decoration.line({ class: 'cm-fm-source' })

function build(state: EditorState): DecorationSet {
  const range = state.field(frontMatterField)
  if (!range) {
    return Decoration.none
  }
  const { properties } = range
  if (properties && properties.length > 0 && !touches(state, range)) {
    const widget = new PropertiesWidget(properties, JSON.stringify(properties))
    return Decoration.set(Decoration.replace({ widget, block: true }).range(range.from, range.to))
  }
  const lines: Range<Decoration>[] = []
  const last = state.doc.lineAt(range.to).number
  for (let n = 1; n <= last; n++) {
    lines.push(sourceLine.range(state.doc.line(n).from))
  }
  return Decoration.set(lines)
}

const decorations = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) =>
    tr.docChanged || tr.selection || tr.reconfigured ? build(tr.state) : value,
  provide: (field) => EditorView.decorations.from(field),
})

const theme = EditorView.theme({
  '.cm-fm': {
    padding: 'var(--spacing-gap) var(--spacing-edge-h)',
    cursor: 'text',
  },
  '.cm-fm table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--text-sm)',
  },
  '.cm-fm td': {
    padding: 'var(--spacing-gap-tight) var(--spacing-gap)',
    borderBottom: '1px solid var(--color-border-hairline)',
    verticalAlign: 'top',
  },
  '.cm-fm tr:first-child td': { borderTop: '1px solid var(--color-border-hairline)' },
  '.cm-fm-key': {
    width: '1%',
    whiteSpace: 'nowrap',
    color: 'var(--color-muted-foreground)',
  },
  '.cm-fm-value': { overflowWrap: 'anywhere' },
  '.cm-fm-empty': { color: 'var(--color-muted-foreground)' },
  '.cm-fm-chip': {
    display: 'inline-block',
    marginRight: 'var(--spacing-gap-tight)',
    padding: '0 var(--spacing-gap)',
    borderRadius: 'var(--radius-chip)',
    background: 'var(--color-muted)',
    color: 'var(--color-subtle-foreground)',
  },
  '.cm-fm-tag': { cursor: 'pointer' },
  '.cm-fm-tag:hover': { color: 'var(--color-foreground)' },
  // 閉じの --- の前の行を、Markdown は setext の見出しとして太字にする
  '.cm-fm-source, .cm-fm-source *': {
    color: 'var(--color-subtle-foreground)',
    fontWeight: 'var(--font-weight-normal) !important',
    textDecoration: 'none !important',
  },
  '.cm-fm-source': { background: 'var(--color-gray-25)' },
})

/** 先頭のフロントマターを、カーソルが外にあるあいだ表にして見せる（F-EDIT-5） */
export function frontMatter(): Extension {
  return [frontMatterField, decorations, theme]
}
