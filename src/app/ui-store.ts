import { create } from 'zustand'

interface PromptRequest {
  title: string
  /** null なら確認だけ */
  initial: string | null
  confirmLabel: string
  submit: (value: string) => void
}

interface UiState {
  sidebarVisible: boolean
  prompt: PromptRequest | null
  setSidebarVisible: (sidebarVisible: boolean) => void
  setPrompt: (prompt: PromptRequest | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarVisible: true,
  prompt: null,
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setPrompt: (prompt) => set({ prompt }),
}))
