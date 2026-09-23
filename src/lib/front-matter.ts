import { parseDocument } from 'yaml'

/** 閉じの `---` を探す行数の上限。Rust の `vault_front_matters` と同じ値にする */
export const FRONT_MATTER_MAX_LINES = 1000

const FENCE = /^---[ \t\r]*$/

/**
 * メモの先頭のフロントマターを探し、閉じの `---` の行（0 始まり）を返す。無ければ null。
 * `line` は i 行目の文字列を返し、行が無ければ undefined を返す。
 */
export function findFrontMatter(line: (index: number) => string | undefined): number | null {
  const first = line(0)
  if (first === undefined || !FENCE.test(first.replace(/^﻿/, ''))) {
    return null
  }
  for (let i = 1; i < FRONT_MATTER_MAX_LINES; i++) {
    const text = line(i)
    if (text === undefined) {
      return null
    }
    if (FENCE.test(text)) {
      return i
    }
  }
  return null
}

type PropertyValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'list'; items: string[] }
  | { kind: 'empty' }

export interface Property {
  key: string
  value: PropertyValue
}

function scalarText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value === null || value === undefined) {
    return ''
  }
  return JSON.stringify(value)
}

function toValue(value: unknown): PropertyValue {
  if (value === null || value === undefined) {
    return { kind: 'empty' }
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value }
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return { kind: 'number', text: String(value) }
  }
  if (Array.isArray(value)) {
    return { kind: 'list', items: value.map(scalarText).filter((item) => item !== '') }
  }
  return { kind: 'text', text: scalarText(value) }
}

/** フロントマターの中身（`---` の間）を読む。YAML として読めないか、鍵と値の組でなければ null */
export function parseProperties(yaml: string): Property[] | null {
  const doc = parseDocument(yaml)
  if (doc.errors.length > 0) {
    return null
  }
  const data: unknown = doc.toJS()
  if (data === null || data === undefined) {
    return []
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  return Object.entries(data).map(([key, value]) => ({ key, value: toValue(value) }))
}

const TAG_KEYS = new Set(['tags', 'tag'])

export function isTagKey(key: string): boolean {
  return TAG_KEYS.has(key.toLowerCase())
}

/** `#` を外し、NFC にそろえる。タグにならない文字列なら null */
function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, '').normalize('NFC')
  return tag === '' ? null : tag
}

/**
 * プロパティの `tags`（`tag`）からタグを取り出す。Obsidian と同じく、リストでも
 * `a, b` や `a b` の文字列でもよい。大文字と小文字だけが違うものは最初のものに寄せる
 */
export function tagsOf(properties: readonly Property[]): string[] {
  const seen = new Map<string, string>()
  for (const { key, value } of properties) {
    if (!isTagKey(key)) {
      continue
    }
    let raws: string[] = []
    if (value.kind === 'list') {
      raws = value.items
    } else if (value.kind === 'text' || value.kind === 'number') {
      raws = value.text.split(/[,\s]+/)
    }
    for (const raw of raws) {
      const tag = normalizeTag(raw)
      if (tag && !seen.has(tag.toLowerCase())) {
        seen.set(tag.toLowerCase(), tag)
      }
    }
  }
  return [...seen.values()]
}
