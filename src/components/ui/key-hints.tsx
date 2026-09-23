import { cn } from '@/lib/cn'
import { Code } from './code'

export interface KeyHint {
  /** 押すキー。複数なら並べて出す（`>` `<` など） */
  keys: string[]
  label: string
}

/** 次に押せるキーの控えめな一覧（F-UX-5）。キーは Code の見た目で出す */
export function KeyHints({ hints, className }: { hints: KeyHint[]; className?: string }) {
  return (
    <p
      className={cn(
        'flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground select-none',
        className,
      )}
    >
      {hints.map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1">
          {hint.keys.map((key) => (
            <Code key={key} className="text-subtle-foreground">
              {key}
            </Code>
          ))}
          {hint.label}
        </span>
      ))}
    </p>
  )
}
