import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 本文の中のコード（`hoge`）の見た目。文字の大きさと色は周りに合わせる */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'rounded-sm border border-border-hairline bg-muted px-1 font-mono break-all',
        className,
      )}
    >
      {children}
    </code>
  )
}
