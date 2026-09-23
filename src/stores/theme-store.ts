import { create } from 'zustand'
import {
  type ColorToken,
  copyTheme,
  type CustomTheme,
  DEFAULT_THEME,
  resolveTheme,
  type ThemeId,
  type TokenValue,
} from '@/lib/theme'

interface ThemeState {
  theme: ThemeId
  customThemes: CustomTheme[]
  setTheme: (theme: ThemeId) => void
  setCustomThemes: (customThemes: CustomTheme[]) => void
  /**
   * 今のテーマのトークンを変える。null なら元のプリセットの値に戻す。
   * 組み込みのプリセットは変えず、写したカスタムを作ってそちらへ移る
   */
  setToken: (name: ColorToken, value: TokenValue | null) => void
  /** 今のテーマを写したカスタムを作って、そちらへ移る */
  duplicateTheme: () => void
  renameCustom: (id: string, label: string) => void
  /** 消したものを選んでいれば、元にした組み込みのプリセットへ戻る */
  deleteCustom: (id: string) => void
}

/** 選んでいるテーマと、ユーザーが作ったプリセット。画面への反映と保存は app が購読して行う */
export const useThemeStore = create<ThemeState>()((set) => ({
  theme: DEFAULT_THEME,
  customThemes: [],
  setTheme: (theme) => set({ theme }),
  setCustomThemes: (customThemes) => set({ customThemes }),
  setToken: (name, value) =>
    set(({ theme, customThemes }) => {
      const current = resolveTheme(theme, customThemes)
      if (!current.custom && (value === null || value === current.base.tokens[name])) {
        return {}
      }
      const target = current.custom ?? copyTheme(current, customThemes)
      const tokens = { ...target.tokens }
      if (value === null || value === current.base.tokens[name]) {
        Reflect.deleteProperty(tokens, name)
      } else {
        tokens[name] = value
      }
      const next = { ...target, tokens }
      return {
        theme: next.id,
        customThemes: current.custom
          ? customThemes.map((c) => (c.id === next.id ? next : c))
          : [...customThemes, next],
      }
    }),
  duplicateTheme: () =>
    set(({ theme, customThemes }) => {
      const copy = copyTheme(resolveTheme(theme, customThemes), customThemes)
      return { theme: copy.id, customThemes: [...customThemes, copy] }
    }),
  renameCustom: (id, label) =>
    set(({ customThemes }) => ({
      customThemes: customThemes.map((c) => (c.id === id ? { ...c, label } : c)),
    })),
  deleteCustom: (id) =>
    set(({ theme, customThemes }) => {
      const removed = customThemes.find((c) => c.id === id)
      return {
        theme: theme === id && removed ? removed.base : theme,
        customThemes: customThemes.filter((c) => c.id !== id),
      }
    }),
}))
