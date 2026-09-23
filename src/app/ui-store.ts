import { create } from 'zustand'

interface PromptRequest {
  title: string
  /** null なら確認だけ */
  initial: string | null
  confirmLabel: string
  submit: (value: string) => void
}

export type SidebarSide = 'left' | 'right'

interface UiState {
  sidebarVisible: boolean
  /** サイドバーを本文の左右どちらに置くか。`<C-w>h` / `<C-w>l` や端での移動の向きもこれで決まる */
  sidebarSide: SidebarSide
  settingsOpen: boolean
  prompt: PromptRequest | null
  setSidebarVisible: (sidebarVisible: boolean) => void
  setSidebarSide: (sidebarSide: SidebarSide) => void
  setSettingsOpen: (settingsOpen: boolean) => void
  setPrompt: (prompt: PromptRequest | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarVisible: true,
  sidebarSide: 'left',
  settingsOpen: false,
  prompt: null,
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setSidebarSide: (sidebarSide) => set({ sidebarSide }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPrompt: (prompt) => set({ prompt }),
}))
