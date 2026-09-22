import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface OverlayPanelProps {
  label: string
  children: ReactNode
  onDismiss: () => void
  className?: string
}

/** 画面の上に重ねる箱（パレット、スイッチャー、キー一覧、確認）。影は使わず線で分ける */
export function OverlayPanel({ label, children, onDismiss, className }: OverlayPanelProps) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/10 pt-24 motion-safe:animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'w-[min(560px,calc(100vw-48px))] overflow-hidden rounded-card border border-border bg-popover text-base text-popover-foreground',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
