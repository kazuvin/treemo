import { parseProperties, tagsOf } from '@/lib/front-matter'

export interface TagEntry {
  /** 最初に見つかった書き方 */
  tag: string
  /** そのタグを持つメモ。`a/b` のような入れ子のタグのメモは親の `a` にも入る */
  paths: string[]
}

/**
 * メモごとのフロントマターから、タグ → メモの一覧を作る。大文字と小文字は区別しない。
 * 入れ子のタグ（`project/treemo`）は、親（`project`）で探しても出るようにする
 */
export function buildTagIndex(notes: readonly { path: string; text: string }[]): TagEntry[] {
  const byKey = new Map<string, TagEntry>()
  const add = (tag: string, path: string) => {
    const key = tag.toLowerCase()
    const entry = byKey.get(key)
    if (!entry) {
      byKey.set(key, { tag, paths: [path] })
    } else if (!entry.paths.includes(path)) {
      entry.paths.push(path)
    }
  }
  for (const { path, text } of notes) {
    const properties = parseProperties(text)
    if (!properties) {
      continue
    }
    for (const tag of tagsOf(properties)) {
      const parts = tag.split('/').filter(Boolean)
      for (let i = 1; i <= parts.length; i++) {
        add(parts.slice(0, i).join('/'), path)
      }
    }
  }
  return [...byKey.values()]
    .map((entry) => ({ ...entry, paths: [...entry.paths].sort() }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

export function findTag(index: readonly TagEntry[], tag: string): TagEntry | undefined {
  const key = tag.toLowerCase()
  return index.find((entry) => entry.tag.toLowerCase() === key)
}
