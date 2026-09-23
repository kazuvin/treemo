import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { codeFolding, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** Kotoba のトークン（globals.css）だけで組む。文字は 14px を超えない */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--text-base)',
    color: 'var(--color-foreground)',
    // 背景はウィンドウ（body とテーマの背景画像）に任せる
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: 'var(--leading-relaxed)',
  },
  '.cm-content': {
    padding: 'var(--spacing-edge-top) 0 var(--spacing-edge-bottom)',
    maxWidth: '80ch',
    margin: '0 auto',
  },
  '.cm-line': { padding: '0 var(--spacing-edge-h)' },
  '.cm-cursor': { borderLeftColor: 'var(--color-foreground)' },
  '.cm-fat-cursor': {
    background: 'var(--color-gray-900) !important',
    color: 'var(--color-gray-0) !important',
  },
  // codemirror-vim はフォーカスが外れると枠だけのカーソルを残す。フォーカスの場所は
  // 領域の上端の線で示すので、本文に残る枠は消し忘れにしか見えない
  '&:not(.cm-focused) .cm-fat-cursor': { visibility: 'hidden' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-selected) !important',
  },
  '.cm-foldPlaceholder': {
    background: 'var(--color-muted)',
    border: 'none',
    color: 'var(--color-muted-foreground)',
    padding: '0 var(--spacing-gap-tight)',
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-panels': {
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
    borderTop: '1px solid var(--color-border)',
  },
  '.cm-panels input': { fontFamily: 'var(--font-mono)', outline: 'none' },
})

/**
 * 最初と最後の行へのスクロールは端まで送る。既定はカーソルが見えるところで止まるので、
 * .cm-content の上下の余白（と見出しの上の余白）が隠れたままになる
 */
const scrollToEdges = EditorView.scrollHandler.of((view, range, options) => {
  if (options.y !== 'nearest') {
    return false
  }
  const line = view.state.doc.lineAt(range.head).number
  if (line === 1) {
    view.scrollDOM.scrollTop = 0
    return true
  }
  if (line === view.state.doc.lines) {
    view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight
    return true
  }
  return false
})

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'var(--font-weight-bold)' },
  { tag: tags.strong, fontWeight: 'var(--font-weight-bold)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--color-muted-foreground)' },
  { tag: tags.monospace, background: 'var(--color-muted)', borderRadius: '4px' },
  { tag: tags.quote, color: 'var(--color-subtle-foreground)' },
  {
    tag: [tags.processingInstruction, tags.contentSeparator, tags.meta],
    color: 'var(--color-muted-foreground)',
  },
])

export function baseExtensions(): Extension[] {
  return [
    history(),
    markdown({ base: markdownLanguage }),
    codeFolding({ placeholderText: '…' }),
    syntaxHighlighting(highlight),
    // codemirror-vim は元の選択を透明にするので、VISUAL の選択はこのレイヤーで描く
    drawSelection(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    scrollToEdges,
    theme,
  ]
}
