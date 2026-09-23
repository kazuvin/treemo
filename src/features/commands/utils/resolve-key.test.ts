import type { Command } from '@/lib/command'
import { candidatesFor, nextKeys, resolveKey } from './resolve-key'

function command(id: string, scope: 'global' | 'normal' | 'diagram', sequence: string): Command {
  return { id, title: id, keys: [{ scope, sequence }], run: vi.fn() }
}

const commands = [
  command('palette', 'global', '⌘K'),
  command('switcher', 'normal', '<Space>ff'),
  command('newNote', 'normal', '<Space>fn'),
  command('toggleTask', 'normal', '<Space>x'),
  command('fold', 'diagram', 'za'),
  command('center', 'diagram', 'zz'),
  command('delete', 'diagram', 'dd'),
]
const ctx = { view: null }

describe('resolveKey', () => {
  it('runs a command whose sequence matches exactly', () => {
    const candidates = candidatesFor(commands, ['global'], ctx)
    const result = resolveKey(candidates, ['D-k'])
    expect(result).toEqual({ kind: 'run', command: commands[0] })
  })

  it('waits while the buffer is a prefix of a sequence', () => {
    const candidates = candidatesFor(commands, ['normal'], ctx)
    expect(resolveKey(candidates, ['Space'])).toEqual({ kind: 'pending', pending: ['Space'] })
    expect(resolveKey(candidates, ['Space', 'f'])).toEqual({
      kind: 'pending',
      pending: ['Space', 'f'],
    })
    expect(resolveKey(candidates, ['Space', 'f', 'n'])).toEqual({
      kind: 'run',
      command: commands[2],
    })
  })

  it('ignores commands outside the active scopes', () => {
    const candidates = candidatesFor(commands, ['global'], ctx)
    expect(resolveKey(candidates, ['d'])).toEqual({ kind: 'none' })
  })

  it('ignores commands whose condition is false', () => {
    const hidden: Command = { ...command('hidden', 'global', '⌘H'), when: () => false }
    const candidates = candidatesFor([hidden], ['global'], ctx)
    expect(resolveKey(candidates, ['D-h'])).toEqual({ kind: 'none' })
  })

  it('returns none when the sequence diverges', () => {
    const candidates = candidatesFor(commands, ['diagram'], ctx)
    expect(resolveKey(candidates, ['d', 'x'])).toEqual({ kind: 'none' })
  })
})

describe('nextKeys', () => {
  it('lists the keys that can follow, with groups as null', () => {
    const candidates = candidatesFor(commands, ['normal'], ctx)
    expect(nextKeys(candidates, ['Space'])).toEqual([
      { token: 'f', command: null },
      { token: 'x', command: commands[3] },
    ])
    expect(nextKeys(candidates, ['Space', 'f']).map((k) => k.token)).toEqual(['f', 'n'])
  })
})
