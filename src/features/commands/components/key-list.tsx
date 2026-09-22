import { useEffect, useRef } from 'react'
import { Kbd } from '@/components/ui/kbd'
import { OverlayPanel } from '@/components/ui/overlay-panel'
import type { KeyScope } from '@/lib/command'
import { useCommandStore } from '../stores/command-store'

const SCOPE_LABELS: Record<KeyScope, string> = {
  global: 'どこでも',
  normal: 'NORMAL（エディタとサイドバー）',
  editor: 'エディタ',
  sidebar: 'サイドバー',
  block: 'ツリーブロックの上',
  tree: 'TREE モード',
}

const SCOPE_ORDER: KeyScope[] = ['global', 'normal', 'editor', 'sidebar', 'block', 'tree']

/** キー操作の一覧（F-UX-8）。コマンドの登録から作るので、割り当てと食い違わない */
export function KeyList({ restoreFocus }: { restoreFocus: () => void }) {
  const open = useCommandStore((s) => s.overlay === 'keys')
  const commands = useCommandStore((s) => s.commands)
  const setOverlay = useCommandStore((s) => s.setOverlay)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      listRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }
  const close = () => {
    setOverlay(null)
    restoreFocus()
  }
  return (
    <OverlayPanel
      label="キー操作の一覧"
      onDismiss={close}
      className="w-[min(720px,calc(100vw-48px))]"
    >
      {/* 一覧を読むだけの画面で、j / k / Esc を受ける */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 上のとおり */}
      <div
        ref={listRef}
        role="document"
        tabIndex={-1}
        className="max-h-[70vh] overflow-y-auto px-6 py-5 outline-none"
        onKeyDown={(event) => {
          const el = event.currentTarget
          if (event.key === 'Escape' || event.key === 'q') {
            event.preventDefault()
            close()
          } else if (event.key === 'j') {
            el.scrollBy({ top: 60 })
          } else if (event.key === 'k') {
            el.scrollBy({ top: -60 })
          }
        }}
      >
        <p className="mb-4 text-xs text-muted-foreground">
          j / k でスクロール · Esc で閉じる · Vim の標準の操作はそのまま使えます
        </p>
        {SCOPE_ORDER.map((scope) => {
          const rows = commands.flatMap((command) =>
            (command.keys ?? [])
              .filter((key) => key.scope === scope)
              .map((key) => ({ id: `${command.id}:${key.sequence}`, key, command })),
          )
          if (rows.length === 0) {
            return null
          }
          return (
            <section key={scope} className="mb-6">
              <h2 className="mb-2 font-semibold">{SCOPE_LABELS[scope]}</h2>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-1">
                {rows.map(({ id, key, command }) => (
                  <li key={id} className="flex items-center gap-3">
                    <Kbd className="min-w-12 justify-center">{key.sequence}</Kbd>
                    <span>{command.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </OverlayPanel>
  )
}
