import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { frontMatter } from './front-matter'
import { noteTitle, noteTitleClickHandler } from './note-title'

let view: EditorView | null = null

function setup(doc: string, extensions: Extension[]): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions }),
  })
  return view
}

afterEach(() => {
  view?.destroy()
  view = null
})

describe('noteTitle', () => {
  it('名前を本文の上に出し、文書には書き込まない', () => {
    const v = setup('本文', [noteTitle('計画')])
    const title = v.contentDOM.firstElementChild
    expect(title?.className).toContain('cm-note-title')
    expect(title?.textContent).toBe('計画')
    expect(v.state.doc.toString()).toBe('本文')
  })

  it('フロントマターの表より上に置く', () => {
    const v = setup('---\na: 1\n---\n本文', [frontMatter(), noteTitle('計画')])
    const [first, second] = v.contentDOM.children
    expect(first?.className).toContain('cm-note-title')
    expect(second?.className).toContain('cm-fm')
  })

  it('null なら出さない', () => {
    const v = setup('本文', [noteTitle(null)])
    expect(v.contentDOM.querySelector('.cm-note-title')).toBeNull()
  })

  it('押すと渡した関数を呼ぶ', () => {
    const onClick = vi.fn()
    const v = setup('本文', [noteTitle('計画'), noteTitleClickHandler.of(onClick)])
    v.contentDOM
      .querySelector('.cm-note-title')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
