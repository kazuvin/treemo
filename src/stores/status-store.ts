import { create } from 'zustand'

/**
 * ステータスバーに出す短い知らせ（TREE モードに入れない理由など）。
 * 消えては困るもの（保存の失敗・衝突）はここに出さず、エディタの上に出す。
 */
interface StatusState {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

export const useStatusStore = create<StatusState>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))
