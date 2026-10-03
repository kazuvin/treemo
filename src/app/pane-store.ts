import { create } from 'zustand'
import type { SessionSnapshot } from '@/features/vault/utils/note-session'

/** 本文の領域 1 つの、画面に出す状態。中身は note-controller の Pane が持ち、ここへ写す */
export interface PaneSnapshot {
  /** React の key と、DOM の data-pane-key。左右が入れ替わっても変わらない */
  key: number
  openPath: string | null
  session: SessionSnapshot
}

interface PaneState {
  /** 左から順に並べる */
  panes: PaneSnapshot[]
  /** キー入力を受ける領域の添字。サイドバーに移っても最後の領域を覚えておく */
  active: number
}

export const usePaneStore = create<PaneState>()(() => ({ panes: [], active: 0 }))
