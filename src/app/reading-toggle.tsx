import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useUiStore } from './ui-store'

const ICON = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function PencilIcon() {
  return (
    <svg {...ICON}>
      <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg {...ICON}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  )
}

function Segment({
  selected,
  label,
  onPress,
  children,
}: {
  selected: boolean
  label: string
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-hint=""
      aria-label={label}
      aria-pressed={selected}
      title={label}
      // 押してもフォーカスを動かさない。キー入力は本文が受け続ける
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={cn(
        'grid size-6 place-items-center rounded-sm',
        selected
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** 編集モードと閲覧モードを切り替えるスイッチ（Obsidian の右上のもの）。keyLabel は割り当てたキー */
export function ReadingToggle({ keyLabel }: { keyLabel: string | null }) {
  const reading = useUiStore((s) => s.reading)
  const setReading = useUiStore((s) => s.setReading)
  const suffix = keyLabel ? `（${keyLabel}）` : ''
  return (
    <div
      role="group"
      aria-label="表示"
      className="absolute top-2 right-3 z-10 flex gap-0.5 rounded-sm border border-border bg-card p-0.5"
    >
      <Segment selected={!reading} label={`編集モード${suffix}`} onPress={() => setReading(false)}>
        <PencilIcon />
      </Segment>
      <Segment selected={reading} label={`閲覧モード${suffix}`} onPress={() => setReading(true)}>
        <BookIcon />
      </Segment>
    </div>
  )
}
