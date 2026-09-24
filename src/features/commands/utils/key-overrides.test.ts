import { describe, expect, it } from 'vitest'
import type { Command } from '@/lib/command'
import { applyKeyOverrides, diffKeyOverrides, parseKeyOverrides } from './key-overrides'

const run = () => undefined

const commands: Command[] = [
  {
    id: 'app.focusSidebar',
    title: 'サイドバーへ',
    keys: [{ scope: 'normal', sequence: '<C-w>h' }],
    run,
  },
  { id: 'vault.trash', title: '削除', keys: [{ scope: 'normal', sequence: '<Space>fd' }], run },
  { id: 'app.theme', title: 'テーマ', run },
]

describe('parseKeyOverrides', () => {
  it('コマンドの ID ごとの割り当てを読む', () => {
    const result = parseKeyOverrides(
      '{ "app.focusSidebar": [{ "scope": "normal", "sequence": "<C-h>" }], "vault.trash": [] }',
    )
    expect(result).toEqual({
      ok: true,
      overrides: {
        'app.focusSidebar': [{ scope: 'normal', sequence: '<C-h>' }],
        'vault.trash': [],
      },
    })
  })

  it('TREE モードのころの ID と範囲を DIAGRAM に読み替える', () => {
    const result = parseKeyOverrides('{ "tree.addChild": [{ "scope": "tree", "sequence": "A" }] }')
    expect(result).toEqual({
      ok: true,
      overrides: { 'diagram.addChild': [{ scope: 'diagram', sequence: 'A' }] },
    })
  })

  it('親子・兄弟の移動の ID を画面の向きの ID に読み替える', () => {
    const result = parseKeyOverrides(
      '{ "diagram.parent": [{ "scope": "diagram", "sequence": "b" }], "tree.next": [] }',
    )
    expect(result).toEqual({
      ok: true,
      overrides: {
        'diagram.left': [{ scope: 'diagram', sequence: 'b' }],
        'diagram.down': [],
      },
    })
  })

  it('JSON として読めなければ理由を返す', () => {
    expect(parseKeyOverrides('{').ok).toBe(false)
  })

  it('無い範囲はどこが違うかを返す', () => {
    expect(parseKeyOverrides('{ "a": [{ "scope": "insert", "sequence": "x" }] }')).toEqual({
      ok: false,
      error: expect.stringMatching(/^a\.0\.scope: /),
    })
  })

  it('知らない項目は書き間違いとして落とす', () => {
    expect(
      parseKeyOverrides('{ "a": [{ "scope": "normal", "key": "x", "sequence": "y" }] }').ok,
    ).toBe(false)
  })
})

describe('applyKeyOverrides', () => {
  it('書いたコマンドの割り当てだけを丸ごと置き換える', () => {
    const { commands: out } = applyKeyOverrides(commands, {
      'app.focusSidebar': [{ scope: 'normal', sequence: '<C-h>' }],
      'vault.trash': [],
      'app.theme': [{ scope: 'global', sequence: '⌘T' }],
    })
    expect(out.map((c) => c.keys)).toEqual([
      [{ scope: 'normal', sequence: '<C-h>' }],
      [],
      [{ scope: 'global', sequence: '⌘T' }],
    ])
  })

  it('無いコマンドの ID を返す', () => {
    expect(applyKeyOverrides(commands, { 'app.nope': [] }).unknown).toEqual(['app.nope'])
  })
})

describe('diffKeyOverrides', () => {
  it('既定と違うものだけを残す', () => {
    expect(
      diffKeyOverrides(commands, {
        'app.focusSidebar': [{ scope: 'normal', sequence: '<C-w>h' }],
        'vault.trash': [],
        'app.theme': [{ scope: 'global', sequence: '⌘T' }],
      }),
    ).toEqual({ 'vault.trash': [], 'app.theme': [{ scope: 'global', sequence: '⌘T' }] })
  })

  it('範囲だけが違っても上書きとして残す', () => {
    expect(
      diffKeyOverrides(commands, {
        'app.focusSidebar': [{ scope: 'sidebar', sequence: '<C-w>h' }],
      }),
    ).toEqual({ 'app.focusSidebar': [{ scope: 'sidebar', sequence: '<C-w>h' }] })
  })

  it('無いコマンドの ID は落とす', () => {
    expect(diffKeyOverrides(commands, { 'app.nope': [] })).toEqual({})
  })
})
