import { create } from 'zustand'
import { type BgmChoice, DEFAULT_BGM, DEFAULT_BGM_VOLUME } from '@/lib/ambience'
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
  bgm: BgmChoice
  /** BGM の音量（%） */
  bgmVolume: number
  settingsOpen: boolean
  prompt: PromptRequest | null
  setSidebarVisible: (sidebarVisible: boolean) => void
  setSidebarSide: (sidebarSide: SidebarSide) => void
  setFontSize: (fontSize: number) => void
  setFontFamily: (fontFamily: FontFamilyId) => void
  setBgm: (bgm: BgmChoice) => void
  setBgmVolume: (bgmVolume: number) => void
  setSettingsOpen: (settingsOpen: boolean) => void
  setPrompt: (prompt: PromptRequest | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarVisible: true,
  sidebarSide: 'left',
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: DEFAULT_FONT_FAMILY,
  bgm: DEFAULT_BGM,
  bgmVolume: DEFAULT_BGM_VOLUME,
  settingsOpen: false,
  prompt: null,
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setSidebarSide: (sidebarSide) => set({ sidebarSide }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setBgm: (bgm) => set({ bgm }),
  setBgmVolume: (bgmVolume) => set({ bgmVolume }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPrompt: (prompt) => set({ prompt }),
}))
