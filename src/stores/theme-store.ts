import { create } from 'zustand'
import { DEFAULT_THEME, type ThemeId } from '@/lib/theme'

interface ThemeState {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

/** 選んでいるテーマ。画面への反映と保存は app が購読して行う */
export const useThemeStore = create<ThemeState>()((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => set({ theme }),
}))
