import { create } from 'zustand'
import type { Editing } from '../extensions/tree-state'
import type { StrayLine, TreeNode } from '../types/tree'
import { DEFAULT_ZOOM, sanitizeZoom, type Zoom } from '../utils/zoom'

/** DIAGRAM モード中のブロック。全画面の表示がこれを読む */
interface ActiveSnapshot {
  from: number
  roots: TreeNode[]
  strayLines: StrayLine[]
  path: number[] | null
  editing: Editing | null
  fullscreen: boolean
}

interface DiagramStoreState {
  active: ActiveSnapshot | null
  /** 最後に使った表示（F-TREE-5）。app が保存する */
  preferFullscreen: boolean
  /** 選んでいるノードの近くに次のキーを出すか（F-UX-5）。app が保存する */
  showKeyGuide: boolean
  /** 図の倍率。インラインと全画面で共通。app が保存する */
  zoom: Zoom
  /** 合わせているときに、操作中の図が実際に使っている倍率。`+` `-` はここから 1 段動かす */
  fitScale: number
  setActive: (active: ActiveSnapshot | null) => void
  setPreferFullscreen: (preferFullscreen: boolean) => void
  setShowKeyGuide: (showKeyGuide: boolean) => void
  setZoom: (zoom: Zoom) => void
  setFitScale: (fitScale: number) => void
}

export const useDiagramStore = create<DiagramStoreState>()((set) => ({
  active: null,
  preferFullscreen: false,
  showKeyGuide: true,
  zoom: DEFAULT_ZOOM,
  fitScale: DEFAULT_ZOOM,
  setActive: (active) => set({ active }),
  setPreferFullscreen: (preferFullscreen) => set({ preferFullscreen }),
  setShowKeyGuide: (showKeyGuide) => set({ showKeyGuide }),
  setZoom: (zoom) => set({ zoom: zoom === 'fit' ? 'fit' : sanitizeZoom(zoom) }),
  setFitScale: (fitScale) => set({ fitScale }),
}))
