import { insertNewline } from '@codemirror/commands'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { getCM, vim, Vim } from '@replit/codemirror-vim'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useModeStore, type VimMode } from '@/stores/mode-store'
import type { Editing } from '../extensions/tree-state'

export type CommitNext = 'sibling' | 'child' | 'done'

interface NodeEditorProps {
  initial: string
  cursor: Editing['cursor']
  onCommit: (text: string, next: CommitNext) => void
}

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
  '.cm-fat-cursor': {
    background: 'var(--color-gray-900) !important',
    color: 'var(--color-gray-0) !important',
  },
})

function isInsert(view: EditorView): boolean {
  return Boolean(getCM(view)?.state.vim?.insertMode)
}

function isPending(view: EditorView): boolean {
  const input = getCM(view)?.state.vim?.inputState
  return input != null && (input.operator != null || input.keyBuffer.length > 0)
}

function toVimMode(mode: string): VimMode {
  if (mode === 'insert' || mode === 'replace') {
    return 'INSERT'
  }
  return mode === 'visual' ? 'VISUAL' : 'NORMAL'
}

/**
 * ノードの上に開く小さなエディタ（F-TREE-4）。INSERT の Enter / Tab は
 * マインドマップの道具と同じ意味にしてある（docs/keybindings.md の「ノード編集」）。
 */
export function NodeEditor({ initial, cursor, onCommit }: NodeEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const commit = useEffectEvent((text: string, next: CommitNext) => onCommit(text, next))
  const start = useEffectEvent(() => ({ initial, cursor }))

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
        { key: 'Enter', run: (v) => isInsert(v) && (finish(v, 'sibling'), true) },
        { key: 'Tab', run: (v) => isInsert(v) && (finish(v, 'child'), true) },
        { key: 'Shift-Enter', run: (v) => isInsert(v) && insertNewline(v) },
        {
          key: 'Escape',
          run: (v) => !isInsert(v) && !isPending(v) && (finish(v, 'done'), true),
        },
      ]),
    )
    const setNodeEdit = useModeStore.getState().setNodeEdit
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: at === 'empty' ? '' : doc,
        extensions: [vim(), keys, EditorView.lineWrapping, theme],
      }),
    })
    const cm = getCM(view)
    const onMode = (event: { mode: string }) => setNodeEdit(toVimMode(event.mode))
    cm?.on('vim-mode-change', onMode)
    view.dispatch({ selection: { anchor: at === 'start' ? 0 : view.state.doc.length } })
    view.focus()
    if (cm) {
      Vim.handleKey(cm, at === 'end' ? 'a' : 'i', 'user')
    }
    setNodeEdit('INSERT')
    return () => {
      cm?.off('vim-mode-change', onMode)
      view.destroy()
      setNodeEdit(null)
    }
  }, [])

  return <div ref={ref} className="min-w-16" />
}
