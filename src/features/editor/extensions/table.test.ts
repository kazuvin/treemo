import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { setReading, readingField } from '@/lib/reading'
import { frontMatter } from './front-matter'
import { markdownTable } from './table'

const doc = [
  '前',
  '',
  '| 名前 | **量** | 備考 |',
  '|:--|--:|:-:|',
  '| `a\\|b` | [1](https://example.com) |  |',
  '| c |',
  '',
  '後',
].join('\n')

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
        markdownTable(),
      ],
    }),
  })
  return view
}

function rows(v: EditorView): string[][] {
  return [...v.dom.querySelectorAll('.cm-table tr')].map((tr) =>
    [...tr.children].map((cell) => cell.textContent ?? ''),
  )
}

afterEach(() => {
  view?.destroy()
  view = null
})

describe('table', () => {
  it('カーソルが外にあれば、記号を隠した表にする', () => {
    const v = setup(doc, 0)
    expect(rows(v)).toEqual([
      ['名前', '量', '備考'],
      ['a|b', '1', ''],
      ['c', '', ''],
    ])
    expect(v.dom.querySelector('.cm-table th .cm-lp-strong')?.textContent).toBe('量')
    expect(v.dom.querySelector('.cm-table td .cm-lp-code')?.textContent).toBe('a|b')
  })

  it('区切りの行のコロンで、列をそろえる', () => {
    const v = setup(doc, 0)
    const aligns = [...v.dom.querySelectorAll<HTMLElement>('.cm-table th')].map(
      (th) => th.style.textAlign,
    )
    expect(aligns).toEqual(['left', 'right', 'center'])
  })

  it('カーソルが入ったら生のテキストに戻し、出たら表に戻す', () => {
    const v = setup(doc, 0)
    v.dispatch({ selection: { anchor: doc.indexOf('名前') } })
    expect(v.dom.querySelector('.cm-table')).toBeNull()
    v.dispatch({ selection: { anchor: doc.length } })
    expect(v.dom.querySelector('.cm-table')).not.toBeNull()
  })

  it('閲覧モードではカーソルが入っても表のまま', () => {
    const v = setup(doc, doc.indexOf('名前'))
    expect(v.dom.querySelector('.cm-table')).toBeNull()
    v.dispatch({ effects: setReading.of(true) })
    expect(v.dom.querySelector('.cm-table')).not.toBeNull()
  })

  it('表を押すとカーソルを表の頭に置く', () => {
    const v = setup(doc, 0)
    v.dom
      .querySelector('.cm-table td')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(v.state.selection.main.head).toBe(doc.indexOf('|'))
    expect(v.dom.querySelector('.cm-table')).toBeNull()
  })

  it('コードブロックの中の表は表にしない', () => {
    const v = setup('```\n| a | b |\n|---|---|\n```\n', 0)
    expect(v.dom.querySelector('.cm-table')).toBeNull()
  })
})
