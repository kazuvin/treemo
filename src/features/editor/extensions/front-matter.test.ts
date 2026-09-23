import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bodyStart, frontMatter, frontMatterField, tagClickHandler } from './front-matter'

const doc = '---\ntitle: 計画\ntags: [idea, project/treemo]\n---\n本文'

let view: EditorView | null = null

function setup(anchor: number, onTag = vi.fn()): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: { anchor },
      extensions: [frontMatter(), tagClickHandler.of(onTag)],
    }),
  })
  return view
}

afterEach(() => {
  view?.destroy()
  view = null
})

describe('bodyStart', () => {
  it('フロントマターの次の行の頭を返す', () => {
    expect(bodyStart(doc)).toBe(doc.indexOf('本文'))
  })

  it('フロントマターで終わるメモでは末尾', () => {
    expect(bodyStart('---\na: 1\n---')).toBe('---\na: 1\n---'.length)
  })

  it('無ければ 0', () => {
    expect(bodyStart('本文\n---\na: 1\n---')).toBe(0)
  })
})

describe('frontMatter', () => {
  it('範囲とプロパティを覚え、文書が変わったら読み直す', () => {
    const state = EditorState.create({ doc, extensions: frontMatter() })
    expect(state.field(frontMatterField)?.to).toBe(doc.indexOf('\n本文'))
    const next = state.update({ changes: { from: 0, to: 1, insert: '' } }).state
    expect(next.field(frontMatterField)).toBeNull()
  })

  it('カーソルが外にあれば表にし、中に入ったら YAML に戻す', () => {
    const v = setup(bodyStart(doc))
    const cells = [...v.dom.querySelectorAll('.cm-fm td')].map((td) => td.textContent)
    expect(cells).toEqual(['title', '計画', 'tags', '#idea#project/treemo'])
    v.dispatch({ selection: { anchor: 5 } })
    expect(v.dom.querySelector('.cm-fm')).toBeNull()
    expect(v.dom.querySelectorAll('.cm-fm-source')).toHaveLength(4)
  })

  it('タグを押すと、渡した関数にタグを渡す', () => {
    const onTag = vi.fn()
    const v = setup(bodyStart(doc), onTag)
    const tag = v.dom.querySelector<HTMLElement>('.cm-fm-tag')
    tag?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(onTag).toHaveBeenCalledWith('idea')
  })

  it('読めない YAML は表にしない', () => {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '---\ntags: [a\n---\n本文',
        selection: { anchor: 16 },
        extensions: frontMatter(),
      }),
    })
    expect(view.dom.querySelector('.cm-fm')).toBeNull()
    expect(view.dom.querySelectorAll('.cm-fm-source')).toHaveLength(3)
  })
})
