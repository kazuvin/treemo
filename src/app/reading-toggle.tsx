import { type ReactNode, useEffect, useState } from 'react'
import { useHeld, usePresence } from '@/components/ui/use-presence'
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
        // 選んでいる印の塗りは下に敷いた 1 枚が滑って受け持つので、ボタンは文字の色だけを変える
        'relative grid size-6 place-items-center rounded-sm transition-colors duration-120 ease-standard',
        selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** 切り替えた直後に、どちらにしたかをスイッチの下に出しておく長さ */
const NOTICE_MS = 1600

interface Notice {
  reading: boolean
  /** 同じモードへ続けて切り替えても出し直すための番号 */
  id: number
}

/** 編集モードと閲覧モードを切り替えるスイッチ（Obsidian の右上のもの）。keyLabel は割り当てたキー */
export function ReadingToggle({ keyLabel }: { keyLabel: string | null }) {
  const reading = useUiStore((s) => s.reading)
  const setReading = useUiStore((s) => s.setReading)
  const suffix = keyLabel ? `（${keyLabel}）` : ''
  // キーやパレットで切り替えたときも知らせるので、押したときではなく値の変化で出す
  const [seen, setSeen] = useState(reading)
  const [notice, setNotice] = useState<Notice | null>(null)
  if (seen !== reading) {
    setSeen(reading)
    setNotice({ reading, id: (notice?.id ?? 0) + 1 })
  }
  useEffect(() => {
    if (!notice) {
      return
    }
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])
  const presence = usePresence(notice !== null)
  const shown = useHeld(notice)

  return (
    <div className="absolute top-2 right-3 z-10 flex flex-col items-end">
      <div
        role="group"
        aria-label="表示"
        className="relative flex gap-0.5 rounded-sm border border-border bg-card p-0.5"
      >
        <span
          aria-hidden="true"
          className="absolute top-0.5 left-0.5 size-6 rounded-sm bg-muted motion-safe:transition-transform motion-safe:duration-160 motion-safe:ease-standard"
          // ボタン 1 つ（24px）と間（2px）のぶん横へ滑らせる
          style={{ transform: reading ? 'translateX(26px)' : undefined }}
        />
        <Segment
          selected={!reading}
          label={`編集モード${suffix}`}
          onPress={() => setReading(false)}
        >
          <PencilIcon />
        </Segment>
        <Segment selected={reading} label={`閲覧モード${suffix}`} onPress={() => setReading(true)}>
          <BookIcon />
        </Segment>
      </div>
      <p aria-live="polite" className="mt-1 h-5">
        {presence.mounted && shown && (
          <span
            key={shown.id}
            className={cn(
              'inline-flex h-5 items-center rounded-sm border border-border bg-card px-2 text-2xs whitespace-nowrap text-subtle-foreground',
              presence.closing
                ? 'motion-safe:animate-fade-out-fast'
                : 'motion-safe:animate-fade-in-fast',
            )}
          >
            {shown.reading
              ? `閲覧モード · 書き換えできません${keyLabel ? `（${keyLabel} で戻す）` : ''}`
              : '編集モード'}
          </span>
        )}
      </p>
    </div>
  )
}
