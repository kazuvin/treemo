import { useState } from 'react'
import { Button } from './button'
import { Kbd } from './kbd'
import { OverlayPanel } from './overlay-panel'

interface PromptDialogProps {
  title: string
  /** 入力欄を出すときの初めの値。null なら確認だけ（y / Enter で決める） */
  initial: string | null
  confirmLabel: string
  onSubmit: (value: string) => void
  onCancel: () => void
  closing?: boolean
}

/** 名前の入力や削除の確認。ブラウザの prompt / confirm はキー操作を止めるので使わない */
export function PromptDialog({
  title,
  initial,
  confirmLabel,
  onSubmit,
  onCancel,
  closing,
}: PromptDialogProps) {
  const [value, setValue] = useState(initial ?? '')
  return (
    <OverlayPanel label={title} onDismiss={onCancel} closing={closing}>
      {/* ダイアログの中のどこにフォーカスがあっても Esc / y / n を受ける */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 上のとおり */}
      <form
        className="flex flex-col gap-gap px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          } else if (initial === null && (event.key === 'y' || event.key === 'n')) {
            event.preventDefault()
            if (event.key === 'y') {
              onSubmit('')
            } else {
              onCancel()
            }
          }
        }}
      >
        <p className="font-semibold">{title}</p>
        {initial !== null && (
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => {
              const dot = event.target.value.lastIndexOf('.md')
              event.target.setSelectionRange(0, dot === -1 ? event.target.value.length : dot)
            }}
            className="h-control rounded-control border border-input px-3 outline-none focus-visible:border-selected-border"
          />
        )}
        <div className="flex items-center justify-end gap-gap">
          <span className="mr-auto text-2xs text-muted-foreground">
            {initial === null ? 'y で決める · n / Esc でやめる' : 'Enter で決める · Esc でやめる'}
          </span>
          <Button variant="secondary" onClick={onCancel}>
            やめる <Kbd>Esc</Kbd>
          </Button>
          <Button type="submit" autoFocus={initial === null}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </OverlayPanel>
  )
}
