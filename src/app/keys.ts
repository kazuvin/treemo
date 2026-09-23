import { useCommandStore } from '@/features/commands/stores/command-store'
import { feedVimKeys, isVimPending } from '@/features/editor/extensions/vim-bridge'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import type { CommandContext, KeyScope } from '@/lib/command'
import { useModeStore } from '@/stores/mode-store'
import { useStatusStore } from '@/stores/status-store'
import { notes } from './note-controller'
import { useUiStore } from './ui-store'

/** ブロックの上でも Vim に渡してよいキー。これ以外の 1 文字は隠れたテキストを壊しうるので止める */
const PASS_ON_BLOCK = new Set([
  ':',
  '/',
  '?',
  'n',
  'N',
  'u',
  'G',
  'H',
  'L',
  'M',
  'z',
  'C-r',
  'C-d',
  'C-u',
  'C-f',
  'C-b',
  'C-e',
  'C-y',
  'C-o',
  'C-i',
])

function isTextInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

export function getContext(): CommandContext {
  return { view: useVaultStore.getState().openPath ? notes.view : null }
}

/** 今どの範囲のキーが効くか（docs/keybindings.md の「コマンドとキーの範囲」） */
export function getScopes(): KeyScope[] {
  const commands = useCommandStore.getState()
  if (commands.hintTarget || commands.recording) {
    return []
  }
  const scopes: KeyScope[] = ['global']
  const overlayOpen =
    commands.overlay !== null ||
    useUiStore.getState().prompt !== null ||
    useUiStore.getState().settingsOpen ||
    useVaultStore.getState().switcherOpen ||
    useVaultStore.getState().vault === null
  if (overlayOpen || isTextInput(document.activeElement)) {
    return scopes
  }
  const mode = useModeStore.getState()
  if (mode.focus === 'sidebar') {
    return [...scopes, 'sidebar', 'normal']
  }
  const view = getContext().view
  if (mode.focus !== 'editor' || !view || mode.nodeEditing) {
    return scopes
  }
  if (mode.diagram) {
    return [...scopes, 'diagram']
  }
  if (mode.vim === 'VISUAL' || isVimPending(view)) {
    return scopes
  }
  scopes.push('editor')
  if (mode.vim === 'NORMAL') {
    scopes.push('normal')
    if (mode.onTreeBlock) {
      scopes.push('block')
    }
  }
  return scopes
}

export function swallowKey(token: string): boolean {
  if (token.startsWith('D-')) {
    return false
  }
  const scopes = getScopes()
  if (scopes.includes('diagram')) {
    return true
  }
  if (scopes.includes('block')) {
    return (token.length === 1 || token.startsWith('C-')) && !PASS_ON_BLOCK.has(token)
  }
  return false
}

export function replayKeys(tokens: string[]): void {
  const view = getContext().view
  if (view && useModeStore.getState().focus === 'editor') {
    feedVimKeys(view, tokens)
  }
}

export function clearStatusMessage(): void {
  if (useStatusStore.getState().message) {
    useStatusStore.getState().clear()
  }
}
