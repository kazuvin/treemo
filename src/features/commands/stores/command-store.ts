import { create } from 'zustand'
import type { Command, CommandContext } from '@/lib/command'

/** キー操作の手がかりとして重ねて出す画面 */
type Overlay = 'palette' | 'keys' | null

interface CommandState {
  commands: Command[]
  overlay: Overlay
  /** ヒントを出す対象の CSS セレクタ。出していなければ null */
  hintTarget: string | null
  /** 押しかけのキー（`<Space>` のあとなど）。which-key が読む */
  pending: string[]
  /** `<Space>f` のようなまとまりの名前。which-key に出す */
  groups: Record<string, string>
  register: (commands: Command[], groups?: Record<string, string>) => void
  setPending: (pending: string[]) => void
  setOverlay: (overlay: Overlay) => void
  setHintTarget: (hintTarget: string | null) => void
}

export const useCommandStore = create<CommandState>()((set) => ({
  commands: [],
  overlay: null,
  hintTarget: null,
  pending: [],
  groups: {},
  register: (commands, groups = {}) => set({ commands, groups }),
  setPending: (pending) => set({ pending }),
  setOverlay: (overlay) => set({ overlay }),
  setHintTarget: (hintTarget) => set({ hintTarget }),
}))

export function isAvailable(command: Command, ctx: CommandContext): boolean {
  return command.when?.(ctx) ?? true
}
