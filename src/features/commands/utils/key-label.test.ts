import { describe, expect, it } from 'vitest'
import type { Command } from '@/lib/command'
import { keyLabel } from './key-label'

const run = () => undefined

const commands: Command[] = [
  {
    id: 'app.focusEditor',
    title: 'エディタへ',
    keys: [
      { scope: 'normal', sequence: '<C-w>l' },
      { scope: 'sidebar', sequence: 'Esc' },
    ],
    run,
  },
  { id: 'app.theme', title: 'テーマ', run },
]

describe('keyLabel', () => {
  it('最初のキーを返す', () => {
    expect(keyLabel(commands, 'app.focusEditor')).toBe('<C-w>l')
  })

  it('範囲を指定すればその範囲のキーを返す', () => {
    expect(keyLabel(commands, 'app.focusEditor', 'sidebar')).toBe('Esc')
  })

  it('キーが無ければ null', () => {
    expect(keyLabel(commands, 'app.theme')).toBeNull()
    expect(keyLabel(commands, 'app.nope')).toBeNull()
  })
})
