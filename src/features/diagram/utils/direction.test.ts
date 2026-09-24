import { describe, expect, it } from 'vitest'
import { directionOf, treeMove, withDirection } from './direction'

describe('directionOf', () => {
  it('defaults to left-to-right', () => {
    expect(directionOf('')).toBe('lr')
    expect(directionOf(' layout=radial')).toBe('lr')
  })

  it('reads layout=tb', () => {
    expect(directionOf(' layout=tb')).toBe('tb')
    expect(directionOf(' foo=1 layout=tb')).toBe('tb')
  })
})

describe('withDirection', () => {
  it('adds layout=tb and keeps other settings', () => {
    expect(withDirection('', 'tb')).toBe(' layout=tb')
    expect(withDirection(' foo=1', 'tb')).toBe(' foo=1 layout=tb')
  })

  it('replaces an existing layout in place', () => {
    expect(withDirection(' layout=lr foo=1', 'tb')).toBe(' layout=tb foo=1')
  })

  it('drops layout for the default direction', () => {
    expect(withDirection(' layout=tb', 'lr')).toBe('')
    expect(withDirection(' foo=1 layout=tb', 'lr')).toBe(' foo=1')
  })
})

describe('treeMove', () => {
  it('rotates the keys with the tree', () => {
    expect(treeMove('lr', 'left')).toBe('parent')
    expect(treeMove('lr', 'down')).toBe('next')
    expect(treeMove('tb', 'up')).toBe('parent')
    expect(treeMove('tb', 'down')).toBe('child')
    expect(treeMove('tb', 'right')).toBe('next')
  })
})
