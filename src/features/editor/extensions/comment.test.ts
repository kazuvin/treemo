import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { readingField, setReading } from '@/lib/reading'
import { commentSyntax } from './comment'
import { frontMatter } from './front-matter'
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
        commentSyntax(),
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

describe('コメント', () => {
  it('編集中は %% も含めて薄く見せ、中の記法を装飾しない', () => {
    const v = setup('前 %%**秘密**%% 後\n\n次', 17)
    const comment = [...v.dom.querySelectorAll('.cm-comment')].map((e) => e.textContent).join('')
    expect(comment).toBe('%%**秘密**%%')
    expect(v.dom.querySelector('.cm-lp-strong')).toBeNull()
  })

  it('メモがコメントで始まっても、コメントの外は装飾する', () => {
    const v = setup('%% x %%\n\n## 見出し\n\n> 引用\n\n- 項目', 0)
    expect(v.dom.querySelector('.cm-lp-h2')?.textContent).toBe('見出し')
    expect(v.dom.querySelector('.cm-lp-quote')?.textContent?.trim()).toBe('引用')
    expect(v.dom.querySelector('.cm-lp-bullet')).not.toBeNull()
  })

  it('閲覧モードでは隠す。行をまるごと占めるコメントは行ごと消す', () => {
    const v = setup('前 %%x%% 後\n%%\nメモ\n%%\n次', 0)
    v.dispatch({ effects: setReading.of(true) })
    const lines = [...v.dom.querySelectorAll('.cm-line')].map((e) => e.textContent)
    expect(lines).toEqual(['前  後', '次'])
  })
})
