import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Select } from './select'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const options = [
  { value: 12, label: '12px' },
  { value: 14, label: '14px' },
  { value: 16, label: '16px' },
]

let container: HTMLDivElement
let root: Root
let onChange: ReturnType<typeof vi.fn<(value: number) => void>>
let outerKey: ReturnType<typeof vi.fn<() => void>>

function Harness({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const [value, setValue] = useState(14)
  return (
    // 設定画面と同じく、外側の div が一覧の受けなかったキーを受ける
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 上のとおり
    <div onKeyDown={outerKey}>
      <Select
        label="文字の大きさ"
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

function render(initialOpen = true) {
  act(() => {
    root.render(<Harness initialOpen={initialOpen} />)
  })
}

function press(key: string) {
  const target = document.activeElement ?? container
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function listbox() {
  return container.querySelector('[role="listbox"]')
}

function trigger() {
  return container.querySelector('button')
}

beforeEach(() => {
  onChange = vi.fn<(value: number) => void>()
  outerKey = vi.fn<() => void>()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Select', () => {
  it('閉じているときは今の値だけを出す', () => {
    render(false)
    expect(trigger()?.textContent).toBe('14px')
    expect(listbox()).toBeNull()
  })

  it('開くと一覧にフォーカスが移り、今の値から選び始める', () => {
    render()
    expect(document.activeElement).toBe(listbox())
    expect(container.querySelector('[data-highlight="true"]')?.textContent).toBe('14px')
  })

  it('j で動いて Enter で決め、閉じる', () => {
    render()
    press('j')
    press('Enter')
    expect(onChange).toHaveBeenCalledWith(16)
    expect(listbox()).toBeNull()
    expect(trigger()?.textContent).toBe('16px')
  })

  it('端では止まる', () => {
    render()
    press('k')
    press('k')
    press('Enter')
    expect(onChange).toHaveBeenCalledWith(12)
  })

  it('Esc では値を変えずに閉じ、キーを外へ漏らさない', () => {
    render()
    press('j')
    press('Escape')
    expect(onChange).not.toHaveBeenCalled()
    expect(listbox()).toBeNull()
    expect(outerKey).not.toHaveBeenCalled()
  })

  it('押すと開き、選択肢を押すと決まる', () => {
    render(false)
    act(() => trigger()?.click())
    const option = [...container.querySelectorAll('[role="option"]')].find(
      (o) => o.textContent === '12px',
    )
    act(() => (option as HTMLElement | undefined)?.click())
    expect(onChange).toHaveBeenCalledWith(12)
    expect(listbox()).toBeNull()
  })
})
