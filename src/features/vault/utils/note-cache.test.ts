import { describe, expect, it } from 'vitest'
import { NoteCache } from './note-cache'

const note = (content: string) => ({ content, hash: `h-${content}` })

describe('NoteCache', () => {
  it('入れたものを返す', () => {
    const cache = new NoteCache()
    cache.set('a.md', note('a'))
    expect(cache.get('a.md')).toEqual(note('a'))
  })

  it('上限を超えたら、いちばん長く使っていないものから捨てる', () => {
    const cache = new NoteCache(2)
    cache.set('a.md', note('a'))
    cache.set('b.md', note('b'))
    cache.set('a.md', note('a2'))
    cache.set('c.md', note('c'))
    expect(cache.has('b.md')).toBe(false)
    expect(cache.get('a.md')).toEqual(note('a2'))
    expect(cache.has('c.md')).toBe(true)
  })

  it('読みに行っている間に捨てられたものは、あとから入れない', () => {
    const cache = new NoteCache()
    const version = cache.version('a.md')
    cache.delete('a.md')
    cache.set('a.md', note('stale'), version)
    expect(cache.has('a.md')).toBe(false)
    cache.set('a.md', note('fresh'), cache.version('a.md'))
    expect(cache.get('a.md')).toEqual(note('fresh'))
  })

  it('clear のあとは、それより前に始めた読み込みを入れない', () => {
    const cache = new NoteCache()
    const version = cache.version('a.md')
    cache.clear()
    cache.set('a.md', note('stale'), version)
    expect(cache.has('a.md')).toBe(false)
  })
})
