import { create } from 'zustand'
import { DEFAULT_FONT_FAMILY, type FontFamilyId } from '@/lib/font-family'
import { DEFAULT_FONT_SIZE } from '@/lib/font-size'

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
  /** 本文の文字の大きさ（px）。ほかの文字もこれに比例する */
  fontSize: number
  fontFamily: FontFamilyId
  settingsOpen: boolean
  prompt: PromptRequest | null
  setSidebarVisible: (sidebarVisible: boolean) => void
  setSidebarSide: (sidebarSide: SidebarSide) => void
  setFontSize: (fontSize: number) => void
  setFontFamily: (fontFamily: FontFamilyId) => void
  setSettingsOpen: (settingsOpen: boolean) => void
  setPrompt: (prompt: PromptRequest | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarVisible: true,
  sidebarSide: 'left',
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: DEFAULT_FONT_FAMILY,
  settingsOpen: false,
  prompt: null,
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setSidebarSide: (sidebarSide) => set({ sidebarSide }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPrompt: (prompt) => set({ prompt }),
}))
