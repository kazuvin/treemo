import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { allowWhileReading, isReading } from '@/lib/reading'
import { toggleTask } from '../utils/list-ops'
import { frontMatterField } from './front-matter'

/** 記号を隠すだけで中身は残す。カーソル行では付けない */
const HIDDEN_MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'LinkMark', 'QuoteMark'])

const INLINE_CLASSES: Record<string, string> = {
  Emphasis: 'cm-lp-em',
  StrongEmphasis: 'cm-lp-strong',
  InlineCode: 'cm-lp-code',
  Strikethrough: 'cm-lp-strike',
  Link: 'cm-lp-link',
}

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-lp-bullet'
    span.textContent = '•'
    return span
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super()
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('span')
    box.className = this.checked ? 'cm-lp-task cm-lp-task-done' : 'cm-lp-task'
    box.textContent = this.checked ? '✓' : ''
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    box.title = 'チェックを切り替える (<Space>x)'
    box.addEventListener('mousedown', (event) => {
      event.preventDefault()
      const line = view.state.doc.lineAt(this.pos)
      const next = toggleTask(line.text)
      if (next !== null) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: next },
          annotations: allowWhileReading.of(true),
        })
      }
    })
    return box
  }

  override ignoreEvent(): boolean {
    return true
  }
}

class RuleWidget extends WidgetType {
  override eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const hr = document.createElement('span')
    hr.className = 'cm-lp-hr'
    return hr
  }
}

const bullet = Decoration.replace({ widget: new BulletWidget() })
const rule = Decoration.replace({ widget: new RuleWidget() })
const hide = Decoration.replace({})

function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  if (isReading(state)) {
    return lines
  }
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) {
      lines.add(n)
    }
  }
  return lines
}

function build(view: EditorView): DecorationSet {
  const { state } = view
  const active = activeLines(state)
  const decorations: Range<Decoration>[] = []
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number)
  // フロントマターの --- と中身は、Markdown としては水平線や見出しに読まれてしまう
  const bodyFrom = (state.field(frontMatterField, false)?.to ?? -1) + 1
  const lineClass = (pos: number, className: string) => {
    decorations.push(Decoration.line({ class: className }).range(state.doc.lineAt(pos).from))
  }

  for (const { from, to } of view.visibleRanges) {
    if (to < bodyFrom) {
      continue
    }
    syntaxTree(state).iterate({
      from: Math.max(from, bodyFrom),
      to,
      enter: (node) => {
        if (node.from < bodyFrom) {
          return
        }
        const name = node.name
        const heading = /^ATXHeading(\d)$/.exec(name)
        if (heading) {
          lineClass(node.from, `cm-lp-h cm-lp-h${heading[1]}`)
          return
        }
        if (name === 'HeaderMark') {
          if (!isActive(node.from) && node.node.parent?.name.startsWith('ATXHeading')) {
            const after = state.doc.sliceString(node.to, node.to + 1)
            decorations.push(hide.range(node.from, after === ' ' ? node.to + 1 : node.to))
          }
          return
        }
        if (name === 'FencedCode') {
          const first = state.doc.lineAt(node.from).number
          const last = state.doc.lineAt(node.to).number
          for (let n = first; n <= last; n++) {
            lineClass(state.doc.line(n).from, 'cm-lp-codeblock')
          }
          return false
        }
        if (name === 'Blockquote') {
          const first = state.doc.lineAt(node.from).number
          const last = state.doc.lineAt(node.to).number
          for (let n = first; n <= last; n++) {
            lineClass(state.doc.line(n).from, 'cm-lp-quote')
          }
          return
        }
        const inlineClass = INLINE_CLASSES[name]
        if (inlineClass && node.to > node.from) {
          decorations.push(Decoration.mark({ class: inlineClass }).range(node.from, node.to))
        }
        if (isActive(node.from)) {
          return
        }
        if (HIDDEN_MARKS.has(name) && node.to > node.from) {
          decorations.push(hide.range(node.from, node.to))
        } else if (name === 'CodeMark' && node.node.parent?.name === 'InlineCode') {
          decorations.push(hide.range(node.from, node.to))
        } else if (name === 'URL' && node.node.parent?.name === 'Link') {
          decorations.push(hide.range(node.from, node.to))
        } else if (name === 'LinkTitle') {
          decorations.push(hide.range(node.from, node.to))
        } else if (name === 'ListMark' && node.node.parent?.parent?.name === 'BulletList') {
          const hasTask = node.node.parent.getChild('Task') !== null
          const end = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          decorations.push(hasTask ? hide.range(node.from, end) : bullet.range(node.from, node.to))
        } else if (name === 'TaskMarker') {
          const checked = /x/i.test(state.doc.sliceString(node.from, node.to))
          decorations.push(
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(
              node.from,
              node.to,
            ),
          )
        } else if (name === 'HorizontalRule') {
          decorations.push(rule.range(node.from, node.to))
        }
        return
      },
    })
  }
  return Decoration.set(decorations, true)
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = build(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        isReading(update.startState) !== isReading(update.state) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/** 見出しは大きさではなく太さ・色・余白で段を付ける（14px が上限） */
const theme = EditorView.theme({
  '.cm-lp-h': { fontWeight: 'var(--font-weight-bold)' },
  '.cm-lp-h1': { paddingTop: 'var(--spacing-block-tight) !important' },
  '.cm-lp-h2': { paddingTop: 'var(--spacing-inset-y) !important' },
  '.cm-lp-h3': { paddingTop: 'var(--spacing-gap) !important' },
  '.cm-lp-h4, .cm-lp-h5, .cm-lp-h6': {
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-subtle-foreground)',
  },
  '.cm-lp-strong': { fontWeight: 'var(--font-weight-bold)' },
  '.cm-lp-em': { fontStyle: 'italic' },
  '.cm-lp-strike': {
    textDecoration: 'line-through',
    color: 'var(--color-muted-foreground)',
  },
  '.cm-lp-code': {
    background: 'var(--color-muted)',
    borderRadius: '4px',
    padding: '0 2px',
  },
  '.cm-lp-link': {
    textDecoration: 'underline',
    textDecorationColor: 'var(--color-border-strong)',
    textUnderlineOffset: '3px',
  },
  '.cm-lp-bullet': { color: 'var(--color-muted-foreground)' },
  '.cm-lp-task': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.1em',
    height: '1.1em',
    marginRight: '0.4em',
    verticalAlign: '-0.15em',
    border: '1px solid var(--color-border-strong)',
    borderRadius: '4px',
    fontSize: 'var(--text-xs)',
    lineHeight: '1',
    cursor: 'pointer',
  },
  '.cm-lp-task-done': {
    background: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: 'var(--color-primary-foreground)',
  },
  '.cm-lp-hr': {
    display: 'inline-flex',
    width: '100%',
    verticalAlign: 'middle',
    borderTop: '1px solid var(--color-border)',
  },
  '.cm-lp-quote': {
    borderLeft: '2px solid var(--color-border-strong)',
    color: 'var(--color-subtle-foreground)',
  },
  '.cm-lp-codeblock': { background: 'var(--color-gray-25)' },
})

/** ライブプレビュー（F-EDIT-2）。カーソルのある行だけ生の Markdown で見せる */
export function livePreview(): Extension {
  return [plugin, theme]
}
