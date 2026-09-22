import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { codeFolding, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** Kotoba のトークン（globals.css）だけで組む。文字は 14px を超えない */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--text-base)',
    color: 'var(--color-foreground)',
    backgroundColor: 'var(--color-background)',
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
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'none !important',
    outline: '1px solid var(--color-gray-400) !important',
    color: 'inherit !important',
  },
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
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    theme,
  ]
}
