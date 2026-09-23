import {
  Annotation,
  EditorState,
  type Extension,
  StateEffect,
  StateField,
  type Transaction,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * 閲覧モード（Obsidian の閲覧ビュー）。本文を書き換えられなくし、どの行も装飾した形で見せる。
 * 考え方は docs/keybindings.md の「閲覧モード」
 */
export const setReading = StateEffect.define<boolean>()

/** 閲覧モードでも通す変更（外で書き換わったファイルの読み込み、チェックボックスを押したとき） */
export const allowWhileReading = Annotation.define<boolean>()

const NO_ATTRS: Record<string, string> = {}

const guard = EditorState.transactionFilter.of((tr) =>
  tr.docChanged && isReading(tr.startState) && !tr.annotation(allowWhileReading) ? [] : tr,
)

export const readingField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setReading)) {
        return effect.value
      }
    }
    return value
  },
  provide: (field): Extension => [
    // Vim の入力と CodeMirror の標準のコマンドはこれを見て書き換えをやめる
    EditorState.readOnly.from(field),
    EditorView.editorAttributes.from(field, (on) => (on ? { class: 'cm-reading' } : NO_ATTRS)),
    guard,
  ],
})

export function isReading(state: EditorState): boolean {
  return state.field(readingField, false) ?? false
}

export function readingChanged(tr: Transaction): boolean {
  return isReading(tr.startState) !== isReading(tr.state)
}
