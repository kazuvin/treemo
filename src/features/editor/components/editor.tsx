import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { useModeStore } from '@/stores/mode-store'
import { baseExtensions } from '../extensions/base'
import { livePreview } from '../extensions/live-preview'
import { vimBridge } from '../extensions/vim-bridge'

export interface EditorHandle {
  view: EditorView
  /** 別のメモを読み込む。取り消しの履歴は新しくなる */
  load: (doc: string) => void
}

interface EditorProps {
  /** 外から足す拡張（ツリーブロックなど）。作り直さないよう、呼ぶ側で固定しておく */
  extensions: readonly Extension[]
  onReady: (handle: EditorHandle | null) => void
}

/** 開いているメモの正本（EditorState.doc）を持つエディタ */
export function Editor({ extensions, onReady }: EditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = ref.current
    if (!parent) {
      return
    }
    const all = [
      ...baseExtensions(),
      vimBridge((mode) => useModeStore.getState().setVim(mode)),
      livePreview(),
      ...extensions,
    ]
    const create = (doc: string) => EditorState.create({ doc, extensions: all })
    const view = new EditorView({ parent, state: create('') })
    onReady({ view, load: (doc) => view.setState(create(doc)) })
    return () => {
      onReady(null)
      view.destroy()
    }
  }, [extensions, onReady])

  return <div ref={ref} className="h-full min-h-0" />
}
