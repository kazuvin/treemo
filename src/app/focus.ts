import { useModeStore } from '@/stores/mode-store'
import { notes } from './note-controller'
import { useUiStore } from './ui-store'

let lastFocus: HTMLElement | null = null

/** パレットなどを開く前に、戻る場所を覚える */
export function rememberFocus(): void {
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}

export function restoreFocus(): void {
  const target = lastFocus
  lastFocus = null
  // すぐに戻す。このあとに走るコマンド（ノード編集を始めるなど）がフォーカスを動かせるように
  if (target?.isConnected) {
    target.focus()
  } else {
    focusEditor()
  }
}

export function focusSidebar(): void {
  useUiStore.getState().setSidebarVisible(true)
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-sidebar]')?.focus()
  })
}

export function focusEditor(): void {
  notes.view?.focus()
}

/** フォーカスの入った要素から、キー入力を受け取っている領域を決める（F-UX-7） */
export function trackFocus(target: EventTarget | null): void {
  const el = target instanceof Element ? target : null
  const setFocus = useModeStore.getState().setFocus
  if (el?.closest('[data-sidebar]')) {
    setFocus('sidebar')
  } else if (el?.closest('[data-editor-pane]')) {
    setFocus('editor')
  } else {
    setFocus('overlay')
  }
}
