import type { VaultEntry } from '../api/vault'

export interface FileRow {
  path: string
  /** 表示用の名前。NFC にそろえ、`.md` を外してある */
  name: string
  kind: VaultEntry['kind']
  depth: number
  placeholder: boolean
  conflict: boolean
  expanded: boolean
}

export function displayName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1).normalize('NFC')
  return base.endsWith('.md') ? base.slice(0, -3) : base
}

export function parentDir(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/** フォルダを先に、名前順に並べ、開いているフォルダの中身だけを出す */
export function visibleRows(
  entries: readonly VaultEntry[],
  expanded: ReadonlySet<string>,
): FileRow[] {
  const children = new Map<string, VaultEntry[]>()
  for (const entry of entries) {
    const dir = parentDir(entry.path)
    const list = children.get(dir) ?? []
    list.push(entry)
    children.set(dir, list)
  }
  const rows: FileRow[] = []
  const walk = (dir: string, depth: number) => {
    const list = (children.get(dir) ?? []).sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'dir' ? -1 : 1
      }
      return displayName(a.path).localeCompare(displayName(b.path), 'ja')
    })
    for (const entry of list) {
      const isOpen = entry.kind === 'dir' && expanded.has(entry.path)
      rows.push({
        path: entry.path,
        name: displayName(entry.path),
        kind: entry.kind,
        depth,
        placeholder: entry.placeholder,
        conflict: entry.conflict,
        expanded: isOpen,
      })
      if (isOpen) {
        walk(entry.path, depth + 1)
      }
    }
  }
  walk('', 0)
  return rows
}

/** そのパスが見えるよう、祖先のフォルダをすべて開いた集合を返す */
export function expandAncestors(expanded: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(expanded)
  let dir = parentDir(path)
  while (dir) {
    next.add(dir)
    dir = parentDir(dir)
  }
  return next
}

/** 利用者が打った名前を、保管庫からの相対パス（`.md` 付き）にする */
export function toNotePath(input: string): string | null {
  const trimmed = input
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .normalize('NFC')
  if (!trimmed || trimmed.split('/').some((part) => !part || part.startsWith('.'))) {
    return null
  }
  return trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`
}
