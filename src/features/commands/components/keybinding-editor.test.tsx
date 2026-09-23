import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command } from '@/lib/command'
import { useCommandStore } from '../stores/command-store'
import type { KeyOverrides } from '../utils/key-overrides'
import { KeybindingEditor } from './keybinding-editor'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const run = () => undefined

const commands: Command[] = [
  {
    id: 'app.focusSidebar',
    title: 'サイドバーへ',
    keys: [{ scope: 'normal', sequence: '<Space>e' }],
    run,
  },
  { id: 'app.settings', title: '設定', keys: [{ scope: 'global', sequence: '⌘,' }], run },
  { id: 'app.theme', title: 'テーマ', run },
]

let container: HTMLDivElement
let root: Root
let onChange: ReturnType<typeof vi.fn<(overrides: KeyOverrides) => void>>

function render(overrides: KeyOverrides = {}) {
  act(() => {
    root.render(<KeybindingEditor commands={commands} overrides={overrides} onChange={onChange} />)
  })
}

function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement ?? container
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  })
}

/** 記録を締める待ち時間を進める */
function settle() {
  act(() => {
    vi.advanceTimersByTime(1000)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  useCommandStore.setState({ recording: false })
  onChange = vi.fn<(overrides: KeyOverrides) => void>()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('KeybindingEditor', () => {
  it('Enter のあとに押したキーで、選んでいる割り当てを置き換える', () => {
    render()
    press('Enter')
    expect(useCommandStore.getState().recording).toBe(true)
    press('h', { ctrlKey: true, code: 'KeyH' })
    settle()
    expect(onChange).toHaveBeenLastCalledWith({
      'app.focusSidebar': [{ scope: 'normal', sequence: '<C-h>' }],
    })
    expect(useCommandStore.getState().recording).toBe(false)
  })

  it('続けて押したキーは 1 つの割り当てになり、a は割り当てを足す', () => {
    render()
    press('a')
    press(' ')
    press('e')
    press('e')
    settle()
    expect(onChange).toHaveBeenLastCalledWith({
      'app.focusSidebar': [
        { scope: 'normal', sequence: '<Space>e' },
        { scope: 'normal', sequence: '<Space>ee' },
      ],
    })
  })

  it('⌘ の組み合わせは global にする', () => {
    render()
    press('j')
    press('j')
    press('a')
    press('t', { metaKey: true, code: 'KeyT' })
    settle()
    expect(onChange).toHaveBeenLastCalledWith({
      'app.theme': [{ scope: 'global', sequence: '⌘T' }],
    })
  })

  it('最初に Esc を押すと記録をやめる', () => {
    render()
    press('Enter')
    press('Escape')
    settle()
    expect(onChange).not.toHaveBeenCalled()
    expect(useCommandStore.getState().recording).toBe(false)
  })

  it('d で外し、r で既定に戻す', () => {
    render({ 'app.focusSidebar': [{ scope: 'normal', sequence: '<C-h>' }] })
    press('d')
    expect(onChange).toHaveBeenLastCalledWith({ 'app.focusSidebar': [] })
    press('r')
    expect(onChange).toHaveBeenLastCalledWith({})
  })
})
