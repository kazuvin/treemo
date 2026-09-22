import { minimalChange } from './minimal-change'

describe('minimalChange', () => {
  it('returns only the differing middle', () => {
    expect(minimalChange('hello world', 'hello brave world')).toEqual({
      from: 6,
      to: 6,
      insert: 'brave ',
    })
    expect(minimalChange('abcdef', 'abXef')).toEqual({ from: 2, to: 4, insert: 'X' })
  })

  it('returns null for identical text', () => {
    expect(minimalChange('same', 'same')).toBeNull()
  })

  it('applies back to the target', () => {
    const cases: [string, string][] = [
      ['aaa', 'aa'],
      ['', 'x'],
      ['x', ''],
      ['abab', 'ab'],
    ]
    for (const [before, after] of cases) {
      const change = minimalChange(before, after)!
      expect(before.slice(0, change.from) + change.insert + before.slice(change.to)).toBe(after)
    }
  })
})
