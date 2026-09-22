import type { Command, CommandContext, KeyScope } from '@/lib/command'
import { matchSequence, parseSequence } from '@/lib/keys'
import { isAvailable } from '../stores/command-store'

export type KeyResolution =
  | { kind: 'run'; command: Command }
  | { kind: 'pending'; pending: string[] }
  | { kind: 'none' }

export interface Candidate {
  command: Command
  tokens: string[]
}

export function candidatesFor(
  commands: readonly Command[],
  scopes: readonly KeyScope[],
  ctx: CommandContext,
): Candidate[] {
  const out: Candidate[] = []
  for (const command of commands) {
    for (const key of command.keys ?? []) {
      if (!key.passive && scopes.includes(key.scope) && isAvailable(command, ctx)) {
        out.push({ command, tokens: parseSequence(key.sequence) })
      }
    }
  }
  return out
}

/**
 * 押しかけのキーに 1 つ足して、コマンドを走らせるか、続きを待つかを決める。
 * 完全に一致するものと、それを先頭に持つ長いものの両方があれば、長い方を待つ。
 */
export function resolveKey(
  candidates: readonly Candidate[],
  buffer: readonly string[],
): KeyResolution {
  let exact: Command | null = null
  let prefix = false
  for (const candidate of candidates) {
    const match = matchSequence(buffer, candidate.tokens)
    if (match === 'exact') {
      exact ??= candidate.command
    } else if (match === 'prefix') {
      prefix = true
    }
  }
  if (prefix) {
    return { kind: 'pending', pending: [...buffer] }
  }
  if (exact) {
    return { kind: 'run', command: exact }
  }
  return { kind: 'none' }
}

/** 押しかけのキーに続けて押せるキーと、その先にあるもの（which-key 用） */
export function nextKeys(
  candidates: readonly Candidate[],
  buffer: readonly string[],
): { token: string; command: Command | null }[] {
  const byToken = new Map<string, Command | null>()
  for (const candidate of candidates) {
    if (matchSequence(buffer, candidate.tokens) !== 'prefix') {
      continue
    }
    const token = candidate.tokens[buffer.length] ?? ''
    const isLast = candidate.tokens.length === buffer.length + 1
    if (isLast) {
      byToken.set(token, candidate.command)
    } else if (!byToken.has(token)) {
      byToken.set(token, null)
    }
  }
  return [...byToken.entries()]
    .map(([token, command]) => ({ token, command }))
    .sort((a, b) => a.token.localeCompare(b.token))
}
