import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption<T> {
  value: T
  label: string
  /** 一覧の中でだけ効かせる見た目（書体の見本など） */
  style?: CSSProperties
}

interface SelectProps<T> {
  label: string
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 開くのは親が決める（設定画面では項目の上で Enter を押したとき） */
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}

/**
 * 値を 1 つ選ぶ箱。開くと一覧がキーを受け、j / k で動いて Enter で決める。
 * 閉じたら親がフォーカスを戻す（onOpenChange(false) のあと）。
 */
export function Select<T>({
  label,
  options,
  value,
  onChange,
  open,
  onOpenChange,
  className,
}: SelectProps<T>) {
  const current = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  )
  const [highlight, setHighlight] = useState(current)
  const [wasOpen, setWasOpen] = useState(open)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()

  // 開くたびに今の値から選び始める
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHighlight(current)
    }
  }

  useEffect(() => {
    if (open) {
      listRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector('[data-highlight="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const choose = (index: number) => {
    const option = options[index]
    if (option) {
      onChange(option.value)
    }
    onOpenChange(false)
  }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        // 開いているときに押しても、一覧の blur で閉じてからまた開かないようにする
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOpenChange(!open)}
        className="flex h-7 min-w-32 items-center justify-between gap-2 rounded-sm border border-border-strong bg-background px-2 text-sm"
      >
        <span className="truncate">{options[current]?.label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-3.5 shrink-0 fill-none stroke-current stroke-2 text-muted-foreground"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${highlight}`}
          onBlur={() => onOpenChange(false)}
          onKeyDown={(event) => {
            switch (event.key) {
              case 'j':
              case 'ArrowDown':
                setHighlight(Math.min(highlight + 1, options.length - 1))
                break
              case 'k':
              case 'ArrowUp':
                setHighlight(Math.max(highlight - 1, 0))
                break
              case 'g':
                setHighlight(0)
                break
              case 'G':
                setHighlight(options.length - 1)
                break
              case 'Enter':
              case ' ':
                choose(highlight)
                break
              case 'Escape':
              case 'q':
              case 'h':
                onOpenChange(false)
                break
              default:
                // Tab などを外へ漏らさない
                break
            }
            event.preventDefault()
            event.stopPropagation()
          }}
          className="absolute top-full right-0 z-10 mt-1 max-h-72 min-w-full overflow-y-auto rounded-sm border border-border-strong bg-popover p-1 outline-none"
        >
          {options.map((option, i) => (
            // キーは一覧が受ける
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- 上のとおり
            <div
              key={option.label}
              id={`${id}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === current}
              data-highlight={i === highlight}
              // 押したときに一覧の blur で先に閉じないようにする
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(i)}
              style={option.style}
              className={cn(
                'flex h-7 cursor-default items-center gap-2 rounded-sm px-2 text-sm whitespace-nowrap',
                i === highlight && 'bg-selected',
                i === current ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
