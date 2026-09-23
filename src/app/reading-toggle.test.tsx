import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadingToggle } from './reading-toggle'
import { useUiStore } from './ui-store'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  useUiStore.getState().setReading(false)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(<ReadingToggle keyLabel="⌘E" />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function notice(): string {
  return container.querySelector('[aria-live]')?.textContent ?? ''
}

describe('ReadingToggle', () => {
  it('開いた直後は知らせを出さない', () => {
    expect(notice()).toBe('')
  })

  it('切り替えるとどちらにしたかを下に出し、しばらくして消す', () => {
    act(() => useUiStore.getState().setReading(true))
    expect(notice()).toBe('閲覧モード')
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    // 消えるアニメーションのあいだは残す
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(notice()).toBe('')
  })

  it('ボタンで切り替えても知らせる', () => {
    const edit = container.querySelector<HTMLButtonElement>('[aria-label^="閲覧モード"]')
    act(() => edit?.click())
    expect(useUiStore.getState().reading).toBe(true)
    act(() => container.querySelector<HTMLButtonElement>('[aria-label^="編集モード"]')?.click())
    expect(notice()).toBe('編集モード')
  })
})
