import { useEffect, useEffectEvent, useState } from 'react'
import { useCommandStore } from '../stores/command-store'

const ALPHABET = 'asdfghjklqwertyuiopzxcvbnm'

interface Hint {
  label: string
  el: HTMLElement
  x: number
  y: number
}

/** 足りなければ 2 文字にする。2 文字のラベルの 1 文字目は 1 文字のラベルと重ならない */
function hintLabels(count: number): string[] {
  if (count <= ALPHABET.length) {
    return ALPHABET.split('').slice(0, count)
  }
  const labels: string[] = []
  for (const a of ALPHABET.split('')) {
    for (const b of ALPHABET.split('')) {
      labels.push(a + b)
    }
  }
  return labels.slice(0, count)
}

function collect(selector: string): Hint[] {
  const els = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
    const rect = el.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    )
  })
  const labels = hintLabels(els.length)
  return els.map((el, i) => {
    const rect = el.getBoundingClientRect()
    return { label: labels[i] ?? '', el, x: rect.left, y: rect.top }
  })
}

function activate(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  el.click()
}

/** ヒント（F-UX-3）。押せる要素にラベルを付け、打ったラベルの要素を押す */
export function Hints() {
  const target = useCommandStore((s) => s.hintTarget)
  const setHintTarget = useCommandStore((s) => s.setHintTarget)
  const [hints, setHints] = useState<Hint[]>([])
  const [typed, setTyped] = useState('')

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === 'Escape') {
      setHintTarget(null)
      return
    }
    if (event.key.length !== 1) {
      return
    }
    const next = typed + event.key.toLowerCase()
    const matches = hints.filter((hint) => hint.label.startsWith(next))
    const exact = matches.find((hint) => hint.label === next)
    if (exact) {
      setHintTarget(null)
      activate(exact.el)
    } else if (matches.length === 0) {
      setHintTarget(null)
    } else {
      setTyped(next)
    }
  })

  useEffect(() => {
    if (!target) {
      return
    }
    const found = collect(target)
    if (found.length === 0) {
      setHintTarget(null)
      return
    }
    // ラベルを出す位置は、ヒントを呼んだ瞬間の DOM から測るしかない
    // oxlint-disable-next-line react/set-state-in-effect -- 上のとおり
    setHints(found)
    setTyped('')
    const handler = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [target, setHintTarget])

  if (!target) {
    return null
  }
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
      {hints
        .filter((hint) => hint.label.startsWith(typed))
        .map((hint) => (
          <span
            key={hint.label}
            className="absolute rounded-sm bg-inverse px-1 font-mono text-xs font-bold text-inverse-foreground"
            style={{ left: hint.x, top: hint.y }}
          >
            <span className="text-gray-400">{typed}</span>
            {hint.label.slice(typed.length)}
          </span>
        ))}
    </div>
  )
}
