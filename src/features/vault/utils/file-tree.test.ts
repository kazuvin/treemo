import type { VaultEntry } from '../api/vault'
import { displayName, expandAncestors, toNotePath, visibleRows } from './file-tree'

function entry(path: string, kind: VaultEntry['kind'] = 'note'): VaultEntry {
  return { path, kind, placeholder: false, conflict: false }
}

const entries = [
  entry('b.md'),
  entry('a', 'dir'),
  entry('a/x.md'),
  entry('a/sub', 'dir'),
  entry('a/sub/y.md'),
  entry('c.md'),
]

describe('visibleRows', () => {
  it('lists folders first and hides the contents of closed folders', () => {
    expect(visibleRows(entries, new Set()).map((r) => r.path)).toEqual(['a', 'b.md', 'c.md'])
  })

  it('shows the contents of open folders with their depth', () => {
    const rows = visibleRows(entries, new Set(['a', 'a/sub']))
    expect(rows.map((r) => [r.path, r.depth])).toEqual([
      ['a', 0],
      ['a/sub', 1],
      ['a/sub/y.md', 2],
      ['a/x.md', 1],
      ['b.md', 0],
      ['c.md', 0],
    ])
  })
})

describe('displayName', () => {
  it('drops the extension and normalizes to NFC', () => {
    expect(displayName('a/メモ.md')).toBe('メモ')
    expect(displayName('が.md')).toBe('が')
  })
})

describe('expandAncestors', () => {
  it('opens every folder above the path', () => {
    expect([...expandAncestors(new Set(), 'a/b/c.md')].sort()).toEqual(['a', 'a/b'])
  })
})

describe('toNotePath', () => {
  it('adds the extension and trims slashes', () => {
    expect(toNotePath(' /dir/メモ/ ')).toBe('dir/メモ.md')
    expect(toNotePath('a.md')).toBe('a.md')
  })

  it('rejects empty or hidden names', () => {
    expect(toNotePath('  ')).toBeNull()
    expect(toNotePath('.hidden')).toBeNull()
    expect(toNotePath('a//b')).toBeNull()
  })
})
