import {
  ensureSyntaxTree,
  foldAll,
  foldCode,
  foldedRanges,
  unfoldAll,
  unfoldCode,
} from '@codemirror/language'
import { setSearchQuery } from '@codemirror/search'
import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import { isReading } from '@/lib/reading'
import type { VimMode } from '@/stores/mode-store'
import { DEFAULT_VIM_CONFIG, type VimConfig } from '../utils/vim-config'

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

/** Markdown の見出しの行（0 始まり）。コードブロックの中の `#` は拾わない */
function headingLines(view: EditorView): number[] {
  const { state } = view
  const lines: number[] = []
  ensureSyntaxTree(state, state.doc.length, 50)?.iterate({
    enter: (node) => {
      if (/^(ATXHeading\d|SetextHeading\d)$/.test(node.name)) {
        lines.push(state.doc.lineAt(node.from).number - 1)
        return false
      }
      return undefined
    },
  })
  return lines
}

let clipboard: VimConfig['clipboard'] = DEFAULT_VIM_CONFIG.clipboard
let configured = false

/** 設定で変わらないもの（Ex コマンド、アクション、モーション）を一度だけ定義する */
function configureVim(): void {
  if (configured) {
    return
  }
  configured = true
  Vim.defineEx('write', 'w', () => exHandlers?.write())
  // :wq と :x は手癖で打つので、閉じずに保存だけする
  Vim.defineEx('wq', 'wq', () => exHandlers?.write())
  Vim.defineEx('xit', 'x', () => exHandlers?.write())
  Vim.defineEx('edit', 'e', (_cm, params) => {
    const name = params.args?.join(' ') ?? ''
    if (name) {
      exHandlers?.edit(name)
    }
  })
  for (const [name, run] of FOLDS) {
    Vim.defineAction(name, (cm) => {
      const view = viewOf(cm)
      if (view) {
        run(view)
      }
    })
  }
  Vim.defineMotion('treemoHeading', (cm, head, args) => {
    const view = viewOf(cm)
    if (!view) {
      return head
    }
    const lines = headingLines(view)
    const candidates = args.forward
      ? lines.filter((line) => line > head.line)
      : lines.filter((line) => line < head.line).reverse()
    const line = candidates[Math.min(args.repeat, candidates.length) - 1]
    return line === undefined ? head : { line, ch: 0 }
  })
  const registers = Vim.getRegisterController()
  const pushText = registers.pushText.bind(registers)
  // clipboard=unnamed の代わり。codemirror-vim には無いので、無名レジスタへのヤンクを写す
  registers.pushText = (name, operator, text, linewise, blockwise) => {
    pushText(name, operator, text, linewise, blockwise)
    if (clipboard === 'unnamed' && operator === 'yank' && !name) {
      void navigator.clipboard?.writeText(text).catch(() => undefined)
    }
  }
}

const FOLDS: [string, (view: EditorView) => void][] = [
  ['treemoFoldToggle', (view) => (isFoldedAt(view) ? unfoldCode(view) : foldCode(view))],
  ['treemoFoldOpen', unfoldCode],
  ['treemoFoldClose', foldCode],
  ['treemoFoldOpenAll', unfoldAll],
  ['treemoFoldCloseAll', foldAll],
]

/** Treemo が Vim に足すキー。設定の mappings より先に入れるので、設定で上書きできる */
function mapBuiltins(): void {
  const folds: [string, string][] = [
    ['za', 'treemoFoldToggle'],
    ['zo', 'treemoFoldOpen'],
    ['zc', 'treemoFoldClose'],
    ['zR', 'treemoFoldOpenAll'],
    ['zM', 'treemoFoldCloseAll'],
  ]
  for (const [keys, name] of folds) {
    Vim.mapCommand(keys, 'action', name, {}, { context: 'normal' })
  }
  Vim.mapCommand(']]', 'motion', 'treemoHeading', { forward: true, toJumplist: true }, {})
  Vim.mapCommand('[[', 'motion', 'treemoHeading', { forward: false, toJumplist: true }, {})
}

/**
 * 設定を Vim に流す。何度呼んでもよい。いったん利用者の割り当てを消してから入れ直すので、
 * 設定から消した割り当ては残らない。
 */
export function applyVimConfig(config: VimConfig): void {
  configureVim()
  clipboard = config.clipboard
  Vim.mapclear()
  mapBuiltins()
  for (const mapping of config.mappings) {
    if (mapping.noremap) {
      Vim.noremap(mapping.lhs, mapping.rhs, mapping.mode)
    } else {
      Vim.map(mapping.lhs, mapping.rhs, mapping.mode)
    }
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

/** 押しても検索の光りを消さないキー。検索を続ける・始めるもの */
const KEEPS_HIGHLIGHT = new Set(['n', 'N', '*', '#', '/', '?', 'Shift', 'Control', 'Alt', 'Meta'])

/**
 * 検索が済んだら光りを消す（docs/keybindings.md の「検索」）。Vim の hlsearch は `:noh` まで
 * 残るが、メモを書くあいだ残り続けると邪魔なので、検索を続けるキー以外を押したら消す
 */
const clearHighlightAfterSearch = ViewPlugin.define((view) => {
  const cm = getCM(view)
  let highlighted = false
  const onKey = (event: KeyboardEvent) => {
    const typingQuery = cm?.state.dialog != null
    const keeps = KEEPS_HIGHLIGHT.has(event.key) && !event.metaKey && !event.ctrlKey
    if (cm?.state.vim && highlighted && !typingQuery && !keeps) {
      // state.vim があることは上で確かめた。型は CodeMirrorV を要求するので合わせる
      Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], 'nohlsearch')
    }
  }
  // DIAGRAM モードのキーはエディタの外（全画面）でも受けるので、文書全体で見る
  document.addEventListener('keydown', onKey, true)
  return {
    update: (update) => {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(setSearchQuery)) {
            highlighted = (effect.value as { forVim?: boolean }).forVim === true
          }
        }
      }
    },
    destroy: () => document.removeEventListener('keydown', onKey, true),
  }
})

/** Vim のキーバインドと、モードが変わったときの知らせ */
export function vimBridge(onModeChange: (mode: VimMode) => void): Extension {
  if (!configured) {
    applyVimConfig(DEFAULT_VIM_CONFIG)
  }
  const listener = ViewPlugin.define((view) => {
    const cm = getCM(view)
    const handler = (event: { mode: string }) => {
      // 閲覧モードでは書けないので、INSERT に入ったらすぐ NORMAL に戻す
      if (cm && event.mode !== 'normal' && event.mode !== 'visual' && isReading(view.state)) {
        queueMicrotask(() => Vim.handleKey(cm, '<Esc>', 'user'))
        return
      }
      onModeChange(toVimMode(event.mode))
    }
    cm?.on('vim-mode-change', handler)
    onModeChange('NORMAL')
    return {
      destroy: () => cm?.off('vim-mode-change', handler),
    }
  })
  return [vim(), listener, clearHighlightAfterSearch]
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
