import { indentItem, listItemAt, moveItem, outdentItem, toggleTask } from './list-ops'

const doc = ['- a', '  - a1', '    more', '  - a2', '- b', '  - b1', '', 'text']

describe('listItemAt', () => {
  it('covers the item and its children', () => {
    expect(listItemAt(doc, 0)).toEqual({ start: 0, end: 3, indent: 0 })
    expect(listItemAt(doc, 1)).toEqual({ start: 1, end: 2, indent: 2 })
  })

  it('finds the item from a continuation line', () => {
    expect(listItemAt(doc, 2)).toEqual({ start: 1, end: 2, indent: 2 })
  })

  it('returns null outside lists', () => {
    expect(listItemAt(doc, 7)).toBeNull()
    expect(listItemAt(doc, 6)).toBeNull()
  })
})

describe('indentItem / outdentItem', () => {
  it('indents the item with its children', () => {
    expect(indentItem(doc, 4)).toEqual({
      from: 4,
      to: 5,
      lines: ['  - b', '    - b1'],
      cursorLine: 4,
    })
  })

  it('outdents the item with its children', () => {
    expect(outdentItem(doc, 1)).toEqual({
      from: 1,
      to: 2,
      lines: ['- a1', '  more'],
      cursorLine: 1,
    })
  })

  it('does not outdent a top-level item', () => {
    expect(outdentItem(doc, 0)).toBeNull()
  })
})

describe('moveItem', () => {
  it('swaps with the next sibling, children included', () => {
    expect(moveItem(doc, 0, 'down')).toEqual({
      from: 0,
      to: 5,
      lines: ['- b', '  - b1', '- a', '  - a1', '    more', '  - a2'],
      cursorLine: 2,
    })
  })

  it('swaps with the previous sibling', () => {
    expect(moveItem(doc, 3, 'up')).toEqual({
      from: 1,
      to: 3,
      lines: ['  - a2', '  - a1', '    more'],
      cursorLine: 1,
    })
  })

  it('does not move past the parent', () => {
    expect(moveItem(doc, 1, 'up')).toBeNull()
    expect(moveItem(doc, 3, 'down')).toBeNull()
  })
})

describe('toggleTask', () => {
  it('toggles the checkbox', () => {
    expect(toggleTask('- [ ] buy')).toBe('- [x] buy')
    expect(toggleTask('  * [X] done')).toBe('  * [ ] done')
  })

  it('adds a checkbox to a plain item', () => {
    expect(toggleTask('- buy')).toBe('- [ ] buy')
    expect(toggleTask('1. step')).toBe('1. [ ] step')
  })

  it('ignores non-list lines', () => {
    expect(toggleTask('text')).toBeNull()
  })
})
