import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface OverlayPanelProps {
  label: string
  children: ReactNode
  onDismiss: () => void
  /** 閉じるアニメーションの最中（usePresence） */
  closing?: boolean
  className?: string
}

/** 画面の上に重ねる箱（パレット、スイッチャー、キー一覧、確認）。影は使わず線で分ける */
export function OverlayPanel({
  label,
  children,
  onDismiss,
  closing,
  className,
}: OverlayPanelProps) {
  return (
    <div
      role="presentation"
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center bg-gray-900/10 pt-24',
        closing
          ? 'pointer-events-none motion-safe:animate-fade-out-fast'
          : 'motion-safe:animate-fade-in-fast',
      )}
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
        aria-hidden={closing}
        className={cn(
          'w-[min(560px,calc(100vw-48px))] overflow-hidden rounded-card border border-border bg-popover text-base text-popover-foreground',
          closing ? 'motion-safe:animate-overlay-out' : 'motion-safe:animate-overlay-in',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
