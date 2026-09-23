import { describe, expect, it } from 'vitest'
import { buildTagIndex, findTag } from './tag-index'

describe('buildTagIndex', () => {
  it('タグごとにメモを集め、名前の順に並べる', () => {
    const index = buildTagIndex([
      { path: 'b.md', text: 'tags: [idea, plan]' },
      { path: 'a.md', text: 'tags: idea' },
      { path: 'c.md', text: 'title: タグ無し' },
    ])
    expect(index).toEqual([
      { tag: 'idea', paths: ['a.md', 'b.md'] },
      { tag: 'plan', paths: ['b.md'] },
    ])
  })

  it('大文字と小文字だけが違うタグはまとめる', () => {
    const index = buildTagIndex([
      { path: 'a.md', text: 'tags: [Idea]' },
      { path: 'b.md', text: 'tags: [idea]' },
    ])
    expect(index).toEqual([{ tag: 'Idea', paths: ['a.md', 'b.md'] }])
  })

  it('入れ子のタグのメモは親のタグにも入る', () => {
    const index = buildTagIndex([
      { path: 'a.md', text: 'tags: [project/treemo]' },
      { path: 'b.md', text: 'tags: [project]' },
    ])
    expect(index).toEqual([
      { tag: 'project', paths: ['a.md', 'b.md'] },
      { tag: 'project/treemo', paths: ['a.md'] },
    ])
  })

  it('読めないフロントマターは飛ばす', () => {
    expect(buildTagIndex([{ path: 'a.md', text: 'tags: [a' }])).toEqual([])
  })
})

describe('findTag', () => {
  it('大文字と小文字を区別せずに探す', () => {
    const index = buildTagIndex([{ path: 'a.md', text: 'tags: [Idea]' }])
    expect(findTag(index, 'idea')?.paths).toEqual(['a.md'])
    expect(findTag(index, 'none')).toBeUndefined()
  })
})
