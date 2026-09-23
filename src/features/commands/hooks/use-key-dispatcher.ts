import { useEffect, useEffectEvent } from 'react'
import type { CommandContext, KeyScope } from '@/lib/command'
import { eventToken, isModifierOnly } from '@/lib/keys'
import { useCommandStore } from '../stores/command-store'
import { candidatesFor, resolveKey } from '../utils/resolve-key'

interface KeyDispatcherOptions {
  /** 今キーが効く範囲 */
  getScopes: () => KeyScope[]
  getContext: () => CommandContext
  /**
   * どのコマンドにもならなかった押しかけのキーを、Vim に渡し直す
   * （ブロックの上の `g` のあとの `g` など）
   */
  replay: (tokens: string[]) => void
  /** どのコマンドにも当たらなかったキーを、エディタに届く前に飲み込むか */
  swallow: (token: string) => boolean
  /** キーを受け取るたびに呼ぶ（ステータスバーの知らせを消すなど） */
  onKey?: () => void
}

/** リーダーや範囲で区切った続けて押すキーは、Vim に渡さない */
const NON_REPLAYABLE = new Set(['Space', 'C-w'])

function stop(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopImmediatePropagation()
}

/**
 * すべてのキーを window の capture で先に受け、登録したコマンドに振り分ける。
 * CodeMirror や Vim より先に走るので、当たらなかったキーだけがエディタに届く。
 */
export function useKeyDispatcher(options: KeyDispatcherOptions): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || isModifierOnly(event)) {
      return
    }
    options.onKey?.()
    const token = eventToken(event)
    const store = useCommandStore.getState()
    const pending = store.pending
    if (pending.length > 0 && token === 'Esc') {
      store.setPending([])
      stop(event)
      return
    }
    const ctx = { ...options.getContext(), repeat: event.repeat }
    const candidates = candidatesFor(store.commands, options.getScopes(), ctx)
    const result = resolveKey(candidates, [...pending, token])
    switch (result.kind) {
      case 'run':
        store.setPending([])
        stop(event)
        result.command.run(ctx)
        return
      case 'pending':
        store.setPending(result.pending)
        stop(event)
        return
      case 'none':
        if (pending.length > 0) {
          store.setPending([])
          stop(event)
          if (!NON_REPLAYABLE.has(pending[0] ?? '')) {
            options.replay([...pending, token])
          }
          return
        }
        if (options.swallow(token)) {
          stop(event)
        }
        return
      default:
        return
    }
  })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [])
}
