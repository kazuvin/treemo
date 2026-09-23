import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useModeStore } from '@/stores/mode-store'
import type { Editing } from '../extensions/tree-state'

export type CommitNext = 'sibling' | 'child' | 'done'

interface NodeEditorProps {
  initial: string
  cursor: Editing['cursor']
  onCommit: (text: string, next: CommitNext) => void
  /** 中身に文字があるか（空白だけなら無い）。開いたときと変わったときに知らせる */
  onHasTextChange: (hasText: boolean) => void
}

const hasText = (state: EditorState) => state.doc.toString().trim() !== ''

const theme = EditorView.theme({
  '&': { fontSize: 'var(--text-base)', background: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.25rem' },
  // 本文のエディタのテーマは子孫セレクタなので、中に置いたこのエディタにも効いてしまう。打ち消す
  '.cm-content': {
    padding: '0 !important',
    margin: '0 !important',
    maxWidth: 'none !important',
    minWidth: '8ch',
  },
  '.cm-line': { padding: '0 !important' },
  // 本文のエディタの Vim は、配下の行の文字カーソルと選択の色を透明にする
  // （`.cm-vimMode .cm-line`）。このエディタは Vim を使わないので、詳細度を上げて戻す
  '&.cm-editor .cm-content .cm-line': { caretColor: 'var(--color-foreground) !important' },
  '&.cm-editor .cm-content .cm-line::selection, &.cm-editor .cm-content .cm-line ::selection': {
    backgroundColor: 'var(--color-selected) !important',
  },
})

/**
 * ノードの上に開く小さなエディタ（F-TREE-4）。DIAGRAM の INSERT にあたり、Esc で確定して
 * DIAGRAM の NORMAL へ戻る。Enter / Tab はマインドマップの道具と同じ意味にしてある
 * （docs/keybindings.md の「ノード編集」）。
 */
export function NodeEditor({ initial, cursor, onCommit, onHasTextChange }: NodeEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const commit = useEffectEvent((text: string, next: CommitNext) => onCommit(text, next))
  const start = useEffectEvent(() => ({ initial, cursor }))
  const reportText = useEffectEvent((value: boolean) => onHasTextChange(value))

  useEffect(() => {
    const parent = ref.current
    if (!parent) {
      return
    }
    const { initial: doc, cursor: at } = start()
    let finished = false
    const finish = (view: EditorView, next: CommitNext) => {
      if (finished) {
        return
      }
      finished = true
      const text = view.state.doc.toString()
      // 確定で親のエディタが描き直され、このエディタが外れる。キー処理を終えてから確定する
      queueMicrotask(() => commit(text, next))
    }
    const keys = Prec.highest(
      keymap.of([
        { key: 'Enter', run: (v) => (finish(v, 'sibling'), true) },
        // 中身の無い親には子を付けない。true を返してフォーカスが外へ出ないようにする
        { key: 'Tab', run: (v) => (hasText(v.state) && finish(v, 'child'), true) },
        { key: 'Shift-Enter', run: insertNewline },
        { key: 'Escape', run: (v) => (finish(v, 'done'), true) },
      ]),
    )
    const setNodeEditing = useModeStore.getState().setNodeEditing
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: at === 'empty' ? '' : doc,
        extensions: [
          history(),
          keys,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              reportText(hasText(update.state))
            }
          }),
          theme,
        ],
      }),
    })
    view.dispatch({ selection: { anchor: at === 'start' ? 0 : view.state.doc.length } })
    view.focus()
    reportText(hasText(view.state))
    setNodeEditing(true)
    return () => {
      view.destroy()
      setNodeEditing(false)
    }
  }, [])

  return <div ref={ref} className="min-w-16" />
}
