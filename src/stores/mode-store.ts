import { create } from 'zustand'

export type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL'

/** キー入力を受け取っている領域（F-UX-7） */
type FocusArea = 'sidebar' | 'editor' | 'overlay'

interface ModeState {
  /** 本文のエディタの Vim のモード */
  vim: VimMode
  /** DIAGRAM モードの中か */
  diagram: boolean
  /** DIAGRAM モードでノードを編集しているか（DIAGRAM の INSERT） */
  nodeEditing: boolean
  /** カーソルがツリーブロックに乗っているか（ブロックの選択状態） */
  onTreeBlock: boolean
  focus: FocusArea
  setVim: (vim: VimMode) => void
  setDiagram: (diagram: boolean) => void
  setNodeEditing: (nodeEditing: boolean) => void
  setOnTreeBlock: (onTreeBlock: boolean) => void
  setFocus: (focus: FocusArea) => void
}

export const useModeStore = create<ModeState>()((set) => ({
  vim: 'NORMAL',
  diagram: false,
  nodeEditing: false,
  onTreeBlock: false,
  focus: 'editor',
  setVim: (vim) => set({ vim }),
  setDiagram: (diagram) => set({ diagram }),
  setNodeEditing: (nodeEditing) => set({ nodeEditing }),
  setOnTreeBlock: (onTreeBlock) => set({ onTreeBlock }),
  setFocus: (focus) => set({ focus }),
}))

/** ステータスバーに出す文字列。DIAGRAM では 'DIAGRAM (NORMAL)' のように中のモードを添える */
export function modeLabel(state: Pick<ModeState, 'vim' | 'diagram' | 'nodeEditing'>): string {
  if (state.diagram) {
    return `DIAGRAM (${state.nodeEditing ? 'INSERT' : 'NORMAL'})`
  }
  return state.vim
}
