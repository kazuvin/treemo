import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends Omit<ComponentProps<'button'>, 'className'> {
  variant?: 'primary' | 'secondary'
  size?: 'default' | 'large'
  fullWidth?: boolean
  className?: string
}

/**
 * Kotoba の Button。外側の button がフォーカスリングとタップ領域を持ち、
 * 内側の span が箱を描く（docs/kotoba-design-system.md の「Button」）。
 */
export function Button({
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'group inline-flex rounded-focus disabled:cursor-not-allowed',
        size === 'default' && 'p-hitslop',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-control px-4 text-base font-semibold transition-colors duration-120 ease-standard',
          size === 'default' ? 'h-control' : 'h-control-lg',
          variant === 'primary'
            ? 'bg-primary text-primary-foreground group-active:bg-primary-pressed'
            : 'border border-border bg-card text-foreground group-active:bg-muted',
          'group-disabled:border-transparent group-disabled:bg-disabled group-disabled:text-disabled-foreground',
        )}
      >
        {children}
      </span>
    </button>
  )
}
