import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** キーの表記。docs/keybindings.md の書き方（⌘K、<Space>ff）をそのまま出す */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 items-center rounded-sm border border-border bg-muted px-1 font-mono text-2xs text-subtle-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
