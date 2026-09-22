import { create } from 'zustand'

export type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL'

/** キー入力を受け取っている領域（F-UX-7） */
type FocusArea = 'sidebar' | 'editor' | 'overlay'

interface ModeState {
  /** 本文のエディタの Vim のモード */
  vim: VimMode
  /** TREE モードの中か */
  tree: boolean
  /** TREE モードでノードを編集している間の、小さなエディタの Vim のモード */
  nodeEdit: VimMode | null
  /** カーソルがツリーブロックに乗っているか（ブロックの選択状態） */
  onTreeBlock: boolean
  focus: FocusArea
  setVim: (vim: VimMode) => void
  setTree: (tree: boolean) => void
  setNodeEdit: (nodeEdit: VimMode | null) => void
  setOnTreeBlock: (onTreeBlock: boolean) => void
  setFocus: (focus: FocusArea) => void
}

export const useModeStore = create<ModeState>()((set) => ({
  vim: 'NORMAL',
  tree: false,
  nodeEdit: null,
  onTreeBlock: false,
  focus: 'editor',
  setVim: (vim) => set({ vim }),
  setTree: (tree) => set({ tree }),
  setNodeEdit: (nodeEdit) => set({ nodeEdit }),
  setOnTreeBlock: (onTreeBlock) => set({ onTreeBlock }),
  setFocus: (focus) => set({ focus }),
}))

/** ステータスバーに出す文字列。'TREE · INSERT' のように重ねる */
export function modeLabel(state: Pick<ModeState, 'vim' | 'tree' | 'nodeEdit'>): string {
  if (state.tree) {
    return state.nodeEdit ? `TREE · ${state.nodeEdit}` : 'TREE'
  }
  return state.vim
}
