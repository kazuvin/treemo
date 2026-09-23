import { create } from 'zustand'
import type { Command, CommandContext } from '@/lib/command'

/** キー操作の手がかりとして重ねて出す画面 */
type Overlay = 'palette' | 'keys' | null

interface CommandState {
  commands: Command[]
  overlay: Overlay
  /** ヒントを出す対象の CSS セレクタ。出していなければ null */
  hintTarget: string | null
  /** 設定画面でキーを記録している間は true。キーをコマンドに振り分けない */
  recording: boolean
  /** 押しかけのキー（`<Space>` のあとなど）。which-key が読む */
  pending: string[]
  /** `<Space>f` のようなまとまりの名前。which-key に出す */
  groups: Record<string, string>
  register: (commands: Command[], groups?: Record<string, string>) => void
  setPending: (pending: string[]) => void
  setOverlay: (overlay: Overlay) => void
  setHintTarget: (hintTarget: string | null) => void
  setRecording: (recording: boolean) => void
}

export const useCommandStore = create<CommandState>()((set) => ({
  commands: [],
  overlay: null,
  hintTarget: null,
  recording: false,
  pending: [],
  groups: {},
  register: (commands, groups = {}) => set({ commands, groups }),
  setPending: (pending) => set({ pending }),
  setOverlay: (overlay) => set({ overlay }),
  setHintTarget: (hintTarget) => set({ hintTarget }),
  setRecording: (recording) => set({ recording }),
}))

export function isAvailable(command: Command, ctx: CommandContext): boolean {
  return command.when?.(ctx) ?? true
}
