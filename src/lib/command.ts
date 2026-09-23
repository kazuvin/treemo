import type { EditorView } from '@codemirror/view'

/**
 * キーが効く範囲。どの範囲が今有効かは app が mode-store から決める。
 * 範囲ごとの意味は docs/keybindings.md の「コマンドとキーの範囲」。
 */
export const KEY_SCOPES = ['global', 'normal', 'editor', 'sidebar', 'block', 'diagram'] as const

export type KeyScope = (typeof KEY_SCOPES)[number]

export interface KeyBinding {
  scope: KeyScope
  /** docs/keybindings.md の表記。'⌘K'、'<Space>ff'、'Tab'、'dd' など */
  sequence: string
  /** Vim 側で割り当ててあり、ここでは一覧やパレットに出すだけのもの（`za` など） */
  passive?: boolean
}

export interface CommandContext {
  /** 開いているメモのエディタ。メモを開いていなければ null */
  view: EditorView | null
  /** キーを押し続けた自動の繰り返しで呼ばれたか。キーから呼ばれたときだけ入る */
  repeat?: boolean
}

export interface Command {
  /** '<feature>.<動作>'。例: 'diagram.addChild' */
  id: string
  /** パレットに出す名前 */
  title: string
  keys?: KeyBinding[]
  when?: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext) => void
}
