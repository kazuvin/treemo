import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { useModeStore } from '@/stores/mode-store'
import { baseExtensions } from '../extensions/base'
import { bodyStart, frontMatter } from '../extensions/front-matter'
import { livePreview } from '../extensions/live-preview'
import { vimBridge } from '../extensions/vim-bridge'

export interface EditorHandle {
  view: EditorView
  /** 別のメモを読み込む。取り消しの履歴は新しくなる。カーソルはフロントマターの次の行に置く */
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
      // Vim は他のキー割り当てより前に置く。後ろだと macOS の Ctrl-d（1 文字削除）などが先に効く
      vimBridge((mode) => useModeStore.getState().setVim(mode)),
      ...baseExtensions(),
      frontMatter(),
      livePreview(),
      ...extensions,
    ]
    const create = (doc: string) =>
      EditorState.create({ doc, extensions: all, selection: { anchor: bodyStart(doc) } })
    const view = new EditorView({ parent, state: create('') })
    onReady({ view, load: (doc) => view.setState(create(doc)) })
    return () => {
      onReady(null)
      view.destroy()
    }
  }, [extensions, onReady])

  return <div ref={ref} className="h-full min-h-0" />
}
