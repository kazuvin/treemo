import { foldAll, foldCode, foldedRanges, unfoldAll, unfoldCode } from '@codemirror/language'
import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import type { VimMode } from '@/stores/mode-store'

export interface ExHandlers {
  write: () => void
  edit: (name: string) => void
}

let exHandlers: ExHandlers | null = null

/** `:w` と `:e 名前` の行き先。保存やメモを開く処理は vault 側にあるので、app が渡す */
export function setExHandlers(handlers: ExHandlers | null): void {
  exHandlers = handlers
}

function viewOf(cm: unknown): EditorView | null {
  if (typeof cm === 'object' && cm !== null && 'cm6' in cm && cm.cm6 instanceof EditorView) {
    return cm.cm6
  }
  return null
}

function isFoldedAt(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  let folded = false
  foldedRanges(view.state).between(line.from, line.to + 1, (from) => {
    if (from >= line.from && from <= line.to) {
      folded = true
    }
  })
  return folded
}

let configured = false

function configureVim(): void {
  if (configured) {
    return
  }
  configured = true
  Vim.defineEx('write', 'w', () => exHandlers?.write())
  Vim.defineEx('edit', 'e', (_cm, params) => {
    const name = params.args?.join(' ') ?? ''
    if (name) {
      exHandlers?.edit(name)
    }
  })
  const folds: [string, string, (view: EditorView) => void][] = [
    ['za', 'treemoFoldToggle', (view) => (isFoldedAt(view) ? unfoldCode(view) : foldCode(view))],
    ['zo', 'treemoFoldOpen', unfoldCode],
    ['zc', 'treemoFoldClose', foldCode],
    ['zR', 'treemoFoldOpenAll', unfoldAll],
    ['zM', 'treemoFoldCloseAll', foldAll],
  ]
  for (const [keys, name, run] of folds) {
    Vim.defineAction(name, (cm) => {
      const view = viewOf(cm)
      if (view) {
        run(view)
      }
    })
    Vim.mapCommand(keys, 'action', name, {}, { context: 'normal' })
  }
}

function toVimMode(mode: string): VimMode {
  if (mode === 'insert' || mode === 'replace') {
    return 'INSERT'
  }
  if (mode === 'visual') {
    return 'VISUAL'
  }
  return 'NORMAL'
}

/** Vim のキーバインドと、モードが変わったときの知らせ */
export function vimBridge(onModeChange: (mode: VimMode) => void): Extension {
  configureVim()
  const listener = ViewPlugin.define((view) => {
    const cm = getCM(view)
    const handler = (event: { mode: string }) => onModeChange(toVimMode(event.mode))
    cm?.on('vim-mode-change', handler)
    onModeChange('NORMAL')
    return {
      destroy: () => cm?.off('vim-mode-change', handler),
    }
  })
  return [vim(), listener]
}

/** Vim がキーの続き（演算子や `f` の文字）を待っているか */
export function isVimPending(view: EditorView): boolean {
  const state = getCM(view)?.state.vim
  if (!state) {
    return false
  }
  const input = state.inputState
  return (
    input.operator != null ||
    input.motion != null ||
    input.keyBuffer.length > 0 ||
    (input.registerName != null && input.registerName !== '')
  )
}

/** Vim にキーを渡す（コマンドにならなかった押しかけのキーを戻すとき） */
export function feedVimKeys(view: EditorView, keys: readonly string[]): void {
  const cm = getCM(view)
  if (!cm) {
    return
  }
  for (const key of keys) {
    Vim.handleKey(cm, key.length === 1 ? key : `<${key}>`, 'user')
  }
}
