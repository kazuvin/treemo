import { ensureSyntaxTree, foldable, foldedRanges, foldEffect } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** 折りたたみを始める行の番号（1 始まり）。アプリの状態として保存する */
export function foldedLines(state: EditorState): number[] {
  const lines: number[] = []
  foldedRanges(state).between(0, state.doc.length, (from) => {
    lines.push(state.doc.lineAt(from).number)
  })
  return lines
}

/** 保存しておいた行で折りたたみ直す。構文が変わって折りたためない行は飛ばす */
export function restoreFolds(view: EditorView, lines: readonly number[]): void {
  const { state } = view
  if (lines.length === 0) {
    return
  }
  ensureSyntaxTree(state, state.doc.length, 200)
  const effects = lines
    .filter((n) => n >= 1 && n <= state.doc.lines)
    .map((n) => {
      const line = state.doc.line(n)
      return foldable(state, line.from, line.to)
    })
    .filter((range): range is { from: number; to: number } => range !== null)
    .map((range) => foldEffect.of(range))
  if (effects.length > 0) {
    view.dispatch({ effects })
  }
}
