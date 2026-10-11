import { describe, expect, it } from 'vitest'
import { findComments, toggleComment } from './comment'

function texts(doc: string): string[] {
  return findComments(doc).map((c) => doc.slice(c.from, c.to))
}

function apply(doc: string, from: number, to = from): { doc: string; cursor: number } {
  const { changes, cursor } = toggleComment(doc, from, to)
  let out = doc
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, change.from) + change.insert + out.slice(change.to)
  }
  return { doc: out, cursor }
}

describe('findComments', () => {
  it('行の中と行をまたぐコメントを見つける', () => {
    expect(texts('a %%x%% b %%y%%')).toEqual(['%%x%%', '%%y%%'])
    expect(texts('a\n%%\nb\nc\n%%\nd')).toEqual(['%%\nb\nc\n%%'])
  })

  it('閉じが無ければ文書の終わりまで', () => {
    const found = findComments('a %%b\nc')
    expect(texts('a %%b\nc')).toEqual(['%%b\nc'])
    expect(found[0]?.closed).toBe(false)
  })

  it('コードブロックとインラインコードの中は数えない', () => {
    expect(texts('```\n%%x%%\n```\n`%%` %%y%%')).toEqual(['%%y%%'])
    expect(texts('~~~~\n```\n%%\n~~~~\n%%z%%')).toEqual(['%%z%%'])
  })

  it('コメントの中のフェンスはコードブロックにしない', () => {
    expect(texts('%%\n```\n%%\nb')).toEqual(['%%\n```\n%%'])
  })
})

describe('toggleComment', () => {
  it('範囲が空なら行の中身を囲む。リストの記号は外に残す', () => {
    expect(apply('- [ ] やる', 3)).toEqual({ doc: '- [ ] %%やる%%', cursor: 8 })
    expect(apply('a\n  1. b\nc', 5).doc).toBe('a\n  1. %%b%%\nc')
  })

  it('空の行には %%%% を書き、間にカーソルを置く', () => {
    expect(apply('a\n\nb', 2)).toEqual({ doc: 'a\n%%%%\nb', cursor: 4 })
  })

  it('選んだ範囲を囲む', () => {
    expect(apply('abc def', 4, 7).doc).toBe('abc %%def%%')
  })

  it('コメントの中なら %% を外す', () => {
    expect(apply('a %%bc%% d', 5)).toEqual({ doc: 'a bc d', cursor: 3 })
    expect(apply('%%\nb\n%%', 3).doc).toBe('\nb\n')
    expect(apply('a %%b', 4).doc).toBe('a b')
  })
})
