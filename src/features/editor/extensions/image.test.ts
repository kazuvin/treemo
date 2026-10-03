import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { readingField } from '@/lib/reading'
import { frontMatter } from './front-matter'
import { imageResolver, images } from './image'
import { livePreview } from './live-preview'

let view: EditorView | null = null

function setup(text: string, anchor: number): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: text,
      selection: { anchor },
      extensions: [
        markdown({ base: markdownLanguage }),
        readingField,
        frontMatter(),
        livePreview(),
        images(),
        imageResolver.of((src) => (src === 'none.png' ? null : `asset://localhost/vault/${src}`)),
      ],
    }),
  })
  ensureSyntaxTree(view.state, view.state.doc.length, 1000)
  view.dispatch({})
  return view
}

afterEach(() => {
  view?.destroy()
  view = null
})

describe('画像', () => {
  it('カーソルの外の行では画像を描く', () => {
    const v = setup('![図](img/a%20b.png)\n\n本文', 22)
    const img = v.dom.querySelector<HTMLImageElement>('.cm-lp-image img')
    expect(img?.getAttribute('src')).toBe('asset://localhost/vault/img/a%20b.png')
    expect(img?.alt).toBe('図')
  })

  it('カーソルのある行では生の Markdown のまま', () => {
    const v = setup('![図](a.png)\n\n本文', 0)
    expect(v.dom.querySelector('.cm-lp-image')).toBeNull()
  })

  it('読めない画像はそう書く', () => {
    const v = setup('![](none.png)\n\n本文', 15)
    expect(v.dom.querySelector('.cm-lp-image-missing')?.textContent).toContain('none.png')
  })
})
