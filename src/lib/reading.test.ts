import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { allowWhileReading, isReading, readingField, setReading } from './reading'

function reading(): EditorState {
  const state = EditorState.create({ doc: 'abc', extensions: readingField })
  return state.update({ effects: setReading.of(true) }).state
}

describe('閲覧モード', () => {
  it('入ると読み取り専用になる', () => {
    const state = reading()
    expect(isReading(state)).toBe(true)
    expect(state.readOnly).toBe(true)
  })

  it('本文の変更を通さない', () => {
    const state = reading().update({ changes: { from: 0, insert: 'x' } }).state
    expect(state.doc.toString()).toBe('abc')
  })

  it('外からの読み込みなど、許した変更は通す', () => {
    const state = reading().update({
      changes: { from: 0, insert: 'x' },
      annotations: allowWhileReading.of(true),
    }).state
    expect(state.doc.toString()).toBe('xabc')
  })

  it('init で始めの状態を決められる', () => {
    const state = EditorState.create({ extensions: readingField.init(() => true) })
    expect(isReading(state)).toBe(true)
  })

  it('入れていないエディタでは編集モードとみなす', () => {
    expect(isReading(EditorState.create())).toBe(false)
  })
})
