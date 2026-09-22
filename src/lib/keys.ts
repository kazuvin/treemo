/**
 * キーの表記（docs/keybindings.md）と KeyboardEvent を、同じ形のトークン列にそろえる。
 * トークンは 'k'、'G'、'Space'、'Tab'、'S-Enter'、'C-w'、'M-l'、'D-k'（⌘K）のような文字列。
 */

const NAMED_KEYS: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'BS',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

const WHOLE_SEQUENCE_KEYS = new Set(['Tab', 'Enter', 'Esc'])

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn'])

export function parseSequence(sequence: string): string[] {
  if (WHOLE_SEQUENCE_KEYS.has(sequence)) {
    return [sequence]
  }
  if (sequence.startsWith('⇧') && WHOLE_SEQUENCE_KEYS.has(sequence.slice(1))) {
    return [`S-${sequence.slice(1)}`]
  }
  const tokens: string[] = []
  const chars = sequence.split('')
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? ''
    if (ch === '<') {
      const end = chars.indexOf('>', i + 1)
      if (end > i + 1) {
        tokens.push(chars.slice(i + 1, end).join(''))
        i = end
        continue
      }
    }
    if (ch === '⌘') {
      const next = chars[i + 1] ?? ''
      tokens.push(`D-${next.toLowerCase()}`)
      i++
      continue
    }
    tokens.push(ch)
  }
  return tokens
}

export function isModifierOnly(event: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(event.key)
}

export function eventToken(event: KeyboardEvent): string {
  const withModifier = event.altKey || event.metaKey || event.ctrlKey
  // macOS の Option はキーの文字を変える（⌥L は '¬'）ので、物理キーから文字を取る
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1]
  let base: string
  if (withModifier && letter) {
    base = event.shiftKey ? letter : letter.toLowerCase()
  } else if (event.key in NAMED_KEYS) {
    base = NAMED_KEYS[event.key] ?? event.key
    if (event.shiftKey) {
      base = `S-${base}`
    }
  } else {
    base = event.key
  }
  if (event.altKey) {
    base = `M-${base}`
  }
  if (event.ctrlKey) {
    base = `C-${base}`
  }
  if (event.metaKey) {
    base = `D-${base}`
  }
  return base
}

export type SequenceMatch = 'exact' | 'prefix' | 'none'

export function matchSequence(buffer: readonly string[], target: readonly string[]): SequenceMatch {
  if (buffer.length > target.length) {
    return 'none'
  }
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== target[i]) {
      return 'none'
    }
  }
  return buffer.length === target.length ? 'exact' : 'prefix'
}

/** トークンを画面に出す形へ戻す（which-key の「次のキー」など） */
export function formatToken(token: string): string {
  if (token.startsWith('D-')) {
    return `⌘${token.slice(2).toUpperCase()}`
  }
  if (token.length > 1) {
    return `<${token}>`
  }
  return token
}
