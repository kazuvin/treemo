import { create } from 'zustand'
import type { Editing } from '../extensions/tree-state'
import type { StrayLine, TreeNode } from '../types/tree'

/** TREE モード中のブロック。全画面の表示がこれを読む */
interface ActiveSnapshot {
  from: number
  roots: TreeNode[]
  strayLines: StrayLine[]
  path: number[] | null
  editing: Editing | null
  fullscreen: boolean
}

interface TreeStoreState {
  active: ActiveSnapshot | null
  /** 最後に使った表示（F-TREE-5）。app が保存する */
  preferFullscreen: boolean
  /** 選んでいるノードの近くに次のキーを出すか（F-UX-5）。app が保存する */
  showKeyGuide: boolean
  setActive: (active: ActiveSnapshot | null) => void
  setPreferFullscreen: (preferFullscreen: boolean) => void
  setShowKeyGuide: (showKeyGuide: boolean) => void
}

export const useTreeStore = create<TreeStoreState>()((set) => ({
  active: null,
  preferFullscreen: false,
  showKeyGuide: true,
  setActive: (active) => set({ active }),
  setPreferFullscreen: (preferFullscreen) => set({ preferFullscreen }),
  setShowKeyGuide: (showKeyGuide) => set({ showKeyGuide }),
}))
