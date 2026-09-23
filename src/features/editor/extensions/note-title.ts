import { type Extension, Facet } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

/** タイトルを押したときに呼ぶもの。app が名前を変える関数を渡す */
export const noteTitleClickHandler = Facet.define<() => void, (() => void) | null>({
  combine: (values) => values[0] ?? null,
})

class TitleWidget extends WidgetType {
  constructor(readonly title: string) {
    super()
  }

  override eq(other: TitleWidget): boolean {
    return other.title === this.title
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-note-title'
    root.textContent = this.title
    root.setAttribute('role', 'heading')
    root.setAttribute('aria-level', '1')
    const onClick = view.state.facet(noteTitleClickHandler)
    if (onClick) {
      root.classList.add('cm-note-title-button')
      root.dataset['hint'] = ''
      root.title = '名前を変える'
      root.addEventListener('mousedown', (event) => {
        event.preventDefault()
        onClick()
      })
    }
    return root
  }

  override ignoreEvent(): boolean {
    return true
  }
}

const theme = EditorView.theme({
  '.cm-note-title': {
    padding: '0 var(--spacing-edge-h) var(--spacing-block-tight)',
    fontSize: 'var(--text-title)',
    lineHeight: 'var(--text-title--line-height)',
    letterSpacing: 'var(--text-title--letter-spacing)',
    fontWeight: 'var(--font-weight-bold)',
    overflowWrap: 'anywhere',
  },
  '.cm-note-title-button': { cursor: 'pointer' },
})

/**
 * 開いているメモの名前を本文の上に出す（F-EDIT-6）。文書の外に描くので、中身は変えない。
 * 名前は EditorState を作るときに渡す。名前を変えるとメモを開き直すので、途中では変わらない
 */
export function noteTitle(title: string | null): Extension {
  if (title === null) {
    return []
  }
  const widget = Decoration.widget({ widget: new TitleWidget(title), block: true, side: -1 })
  return [EditorView.decorations.of(Decoration.set(widget.range(0))), theme]
}
