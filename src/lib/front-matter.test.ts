import { describe, expect, it } from 'vitest'
import { findFrontMatter, parseProperties, tagsOf } from './front-matter'

const lines = (text: string) => {
  const all = text.split('\n')
  return (i: number) => all[i]
}

describe('findFrontMatter', () => {
  it('先頭の --- から閉じの --- までを見つける', () => {
    expect(findFrontMatter(lines('---\ntitle: a\n---\n本文'))).toBe(2)
  })

  it('中身が空でもよい', () => {
    expect(findFrontMatter(lines('---\n---'))).toBe(1)
  })

  it('行末の空白と CRLF、先頭の BOM を許す', () => {
    expect(findFrontMatter(lines('﻿--- \r\na: 1\r\n---\r\n'))).toBe(2)
  })

  it('先頭が --- でなければ無い', () => {
    expect(findFrontMatter(lines('\n---\na: 1\n---'))).toBeNull()
    expect(findFrontMatter(lines('----\na: 1\n---'))).toBeNull()
  })

  it('閉じていなければ無い', () => {
    expect(findFrontMatter(lines('---\na: 1\n本文'))).toBeNull()
  })
})

describe('parseProperties', () => {
  it('値の種類を見分ける', () => {
    const yaml = [
      'title: 計画',
      'created: 2026-09-23',
      'count: 3',
      'done: true',
      'tags: [a, b]',
      'aliases:',
      '  - x',
      'empty:',
    ].join('\n')
    expect(parseProperties(yaml)).toEqual([
      { key: 'title', value: { kind: 'text', text: '計画' } },
      { key: 'created', value: { kind: 'text', text: '2026-09-23' } },
      { key: 'count', value: { kind: 'number', text: '3' } },
      { key: 'done', value: { kind: 'boolean', value: true } },
      { key: 'tags', value: { kind: 'list', items: ['a', 'b'] } },
      { key: 'aliases', value: { kind: 'list', items: ['x'] } },
      { key: 'empty', value: { kind: 'empty' } },
    ])
  })

  it('入れ子の値は JSON の形で見せる', () => {
    expect(parseProperties('meta:\n  a: 1')).toEqual([
      { key: 'meta', value: { kind: 'text', text: '{"a":1}' } },
    ])
  })

  it('空なら何も無い', () => {
    expect(parseProperties('')).toEqual([])
  })

  it('読めない YAML と、鍵と値の組でないものは null', () => {
    expect(parseProperties('a: [1, 2')).toBeNull()
    expect(parseProperties('a: 1\na: 2')).toBeNull()
    expect(parseProperties('- a\n- b')).toBeNull()
    expect(parseProperties('ただの文')).toBeNull()
  })
})

describe('tagsOf', () => {
  it('リストと文字列のどちらからも取り出し、# を外す', () => {
    expect(tagsOf(parseProperties('tags: [a, "#b"]') ?? [])).toEqual(['a', 'b'])
    expect(tagsOf(parseProperties('tags: a, b c') ?? [])).toEqual(['a', 'b', 'c'])
    expect(tagsOf(parseProperties('tag: project/x') ?? [])).toEqual(['project/x'])
  })

  it('大文字と小文字だけが違うものは 1 つにする', () => {
    expect(tagsOf(parseProperties('tags: [Idea, idea, IDEA]') ?? [])).toEqual(['Idea'])
  })

  it('tags 以外の鍵は見ない', () => {
    expect(tagsOf(parseProperties('title: a\naliases: [b]') ?? [])).toEqual([])
  })
})
