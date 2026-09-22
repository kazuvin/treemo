import { Kbd } from '@/components/ui/kbd'
import type { CommandContext, KeyScope } from '@/lib/command'
import { formatToken } from '@/lib/keys'
import { useCommandStore } from '../stores/command-store'
import { candidatesFor, nextKeys } from '../utils/resolve-key'

interface WhichKeyProps {
  getContext: () => CommandContext
  getScopes: () => KeyScope[]
}

/** リーダーキーのあとに押せるキーの一覧（F-UX-2）。コマンドの登録から作る */
export function WhichKey({ getContext, getScopes }: WhichKeyProps) {
  const pending = useCommandStore((s) => s.pending)
  const commands = useCommandStore((s) => s.commands)
  const groups = useCommandStore((s) => s.groups)
  if (pending[0] !== 'Space') {
    return null
  }
  const candidates = candidatesFor(commands, getScopes(), getContext())
  const keys = nextKeys(candidates, pending)
  const prefix = pending.slice(1).join('')
  return (
    <div
      role="status"
      aria-label="続けて押せるキー"
      className="absolute inset-x-0 bottom-0 z-40 border-t border-border bg-popover px-6 py-3 motion-safe:animate-fade-in"
    >
      <p className="mb-2 text-2xs text-muted-foreground">
        {pending.map(formatToken).join('')} · Esc でやめる
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-1">
        {keys.map(({ token, command }) => (
          <li key={token} className="flex items-center gap-2">
            <Kbd>{formatToken(token)}</Kbd>
            <span className={command ? '' : 'text-subtle-foreground'}>
              {command?.title ?? `${groups[prefix + token] ?? '…'} +`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
