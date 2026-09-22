import { eventToken, formatToken, matchSequence, parseSequence } from './keys'

describe('parseSequence', () => {
  it.each([
    ['⌘K', ['D-k']],
    ['⌘\\', ['D-\\']],
    ['<Space>ff', ['Space', 'f', 'f']],
    ['<C-w>h', ['C-w', 'h']],
    ['<M-l>', ['M-l']],
    ['Tab', ['Tab']],
    ['Enter', ['Enter']],
    ['⇧Enter', ['S-Enter']],
    ['gg', ['g', 'g']],
    [']p', [']', 'p']],
    ['<', ['<']],
    ['>', ['>']],
    ['G', ['G']],
  ])('parses %s', (sequence, tokens) => {
    expect(parseSequence(sequence)).toEqual(tokens)
  })
})

describe('eventToken', () => {
  function key(init: KeyboardEventInit): KeyboardEvent {
    return new KeyboardEvent('keydown', init)
  }

  it('maps command combinations to D- tokens', () => {
    expect(eventToken(key({ key: 'k', code: 'KeyK', metaKey: true }))).toBe('D-k')
    expect(eventToken(key({ key: '\\', code: 'Backslash', metaKey: true }))).toBe('D-\\')
  })

  it('reads the physical key when Option changes the character', () => {
    expect(eventToken(key({ key: '¬', code: 'KeyL', altKey: true }))).toBe('M-l')
  })

  it('keeps shifted printable characters as they are', () => {
    expect(eventToken(key({ key: 'G', code: 'KeyG', shiftKey: true }))).toBe('G')
    expect(eventToken(key({ key: '>', code: 'Period', shiftKey: true }))).toBe('>')
  })

  it('names special keys', () => {
    expect(eventToken(key({ key: ' ', code: 'Space' }))).toBe('Space')
    expect(eventToken(key({ key: 'Escape', code: 'Escape' }))).toBe('Esc')
    expect(eventToken(key({ key: 'Enter', code: 'Enter', shiftKey: true }))).toBe('S-Enter')
    expect(eventToken(key({ key: 'w', code: 'KeyW', ctrlKey: true }))).toBe('C-w')
  })
})

describe('matchSequence', () => {
  it('distinguishes exact, prefix and none', () => {
    expect(matchSequence(['a'], ['a'])).toBe('exact')
    expect(matchSequence(['a'], ['a', 'b'])).toBe('prefix')
    expect(matchSequence(['b'], ['a', 'b'])).toBe('none')
    expect(matchSequence(['a', 'b', 'c'], ['a', 'b'])).toBe('none')
  })
})

describe('formatToken', () => {
  it('formats tokens for display', () => {
    expect(formatToken('D-k')).toBe('⌘K')
    expect(formatToken('Space')).toBe('<Space>')
    expect(formatToken('f')).toBe('f')
  })
})
