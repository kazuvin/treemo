import { matchNodes, type VisibleNode } from './motion'

function nodes(...items: [string, number, string][]): VisibleNode[] {
  return items.map(([id, depth, content]) => ({ id, depth, content }))
}

describe('matchNodes', () => {
  it('treats an inserted sibling as new and follows the shifted ones', () => {
    const prev = nodes(['0', 0, 'root'], ['0.0', 1, 'a'], ['0.1', 1, 'b'])
    const next = nodes(['0', 0, 'root'], ['0.0', 1, 'a'], ['0.1', 1, ''], ['0.2', 1, 'b'])
    const map = matchNodes(prev, next)
    expect(map.get('0.2')).toBe('0.1')
    expect(map.has('0.1')).toBe(false)
    expect(map.get('0')).toBe('0')
  })

  it('follows the siblings after a removed subtree', () => {
    const prev = nodes(['0', 0, 'a'], ['0.0', 1, 'x'], ['1', 0, 'b'])
    const next = nodes(['0', 0, 'b'])
    expect(matchNodes(prev, next).get('0')).toBe('1')
  })

  it('follows swapped nodes by their content', () => {
    const prev = nodes(['0', 0, 'a'], ['1', 0, 'b'])
    const next = nodes(['0', 0, 'b'], ['1', 0, 'a'])
    const map = matchNodes(prev, next)
    expect(map.get('0')).toBe('1')
    expect(map.get('1')).toBe('0')
  })

  it('keeps a node whose content was edited in place', () => {
    const prev = nodes(['0', 0, 'a'], ['0.0', 1, ''], ['1', 0, 'b'])
    const next = nodes(['0', 0, 'a'], ['0.0', 1, 'text'], ['1', 0, 'b'])
    expect(matchNodes(prev, next).get('0.0')).toBe('0.0')
  })

  it('keeps the committed node when Enter also adds the next sibling', () => {
    const prev = nodes(['0', 0, 'a'], ['0.0', 1, ''], ['1', 0, 'b'])
    const next = nodes(['0', 0, 'a'], ['0.0', 1, 'text'], ['0.1', 1, ''], ['1', 0, 'b'])
    const map = matchNodes(prev, next)
    expect(map.get('0.0')).toBe('0.0')
    expect(map.has('0.1')).toBe(false)
  })
})
