import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useDiagramStore } from '../stores/diagram-store'
import { DEFAULT_ZOOM, stepZoom, zoomLabel } from '../utils/zoom'

function ZoomButton({
  title,
  selected = false,
  onPress,
  children,
}: {
  title: string
  selected?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={title}
      aria-pressed={selected}
      className={cn(
        'flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border px-1 font-mono text-2xs tabular-nums hover:text-foreground',
        selected
          ? 'border-selected-border bg-selected text-foreground'
          : 'border-border text-muted-foreground',
      )}
      onMouseDown={(event) => {
        // キー入力は本文のエディタ（編集中はノードのエディタ）が受け続ける
        event.preventDefault()
        onPress()
      }}
    >
      {children}
    </button>
  )
}

/** 図の倍率を変えるボタン。キーの `+` `-` `0` `=` と同じことをする */
export function ZoomControl({ className }: { className?: string }) {
  const zoom = useDiagramStore((s) => s.zoom)
  const fitScale = useDiagramStore((s) => s.fitScale)
  const setZoom = useDiagramStore((s) => s.setZoom)
  const scale = zoom === 'fit' ? fitScale : zoom
  return (
    <div className={cn('flex shrink-0 items-center gap-1 select-none', className)}>
      <ZoomButton title="縮小する（-）" onPress={() => setZoom(stepZoom(scale, -1))}>
        −
      </ZoomButton>
      <ZoomButton title="100% に戻す（0）" onPress={() => setZoom(DEFAULT_ZOOM)}>
        {zoomLabel(scale)}
      </ZoomButton>
      <ZoomButton title="拡大する（+）" onPress={() => setZoom(stepZoom(scale, 1))}>
        +
      </ZoomButton>
      <ZoomButton
        title="画面の大きさに合わせる（=）"
        selected={zoom === 'fit'}
        onPress={() => setZoom('fit')}
      >
        合わせる
      </ZoomButton>
    </div>
  )
}
