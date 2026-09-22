import { Command as Cmdk } from 'cmdk'
import { useState } from 'react'
import { OverlayPanel } from '@/components/ui/overlay-panel'
import { useVaultStore } from '../stores/vault-store'
import { toNotePath } from '../utils/file-tree'
import { fuzzyFilter } from '../utils/fuzzy'

const MAX_RESULTS = 50

interface QuickSwitcherProps {
  onOpen: (path: string) => void
  onCreate: (path: string) => void
  onClose: () => void
}

/** クイックスイッチャー（F-VAULT-3）。一致するものが無ければ、打った名前で作れる */
export function QuickSwitcher({ onOpen, onCreate, onClose }: QuickSwitcherProps) {
  const open = useVaultStore((s) => s.switcherOpen)
  const entries = useVaultStore((s) => s.entries)
  const [query, setQuery] = useState('')
  if (!open) {
    return null
  }
  const notes = entries.filter((e) => e.kind === 'note').map((e) => e.path)
  const results = fuzzyFilter(query, notes, (path) => path.replace(/\.md$/, '')).slice(
    0,
    MAX_RESULTS,
  )
  const newPath = toNotePath(query)
  const exists = newPath !== null && notes.some((p) => p.normalize('NFC') === newPath)
  const close = () => {
    setQuery('')
    onClose()
  }
  return (
    <OverlayPanel label="メモを開く" onDismiss={close}>
      <Cmdk
        label="メモを開く"
        shouldFilter={false}
        loop
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      >
        <Cmdk.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="メモの名前（無ければ作る）"
          className="h-12 w-full border-b border-border bg-transparent px-5 outline-none placeholder:text-muted-foreground"
        />
        <Cmdk.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.map((path) => (
            <Cmdk.Item
              key={path}
              value={path}
              onSelect={() => {
                close()
                onOpen(path)
              }}
              className="flex h-9 cursor-default items-center rounded-sm px-3 data-[selected=true]:bg-selected"
            >
              <span className="truncate">{path.replace(/\.md$/, '').normalize('NFC')}</span>
            </Cmdk.Item>
          ))}
          {newPath && !exists && (
            <Cmdk.Item
              value={`create:${newPath}`}
              onSelect={() => {
                close()
                onCreate(newPath)
              }}
              className="flex h-9 cursor-default items-center gap-2 rounded-sm px-3 text-subtle-foreground data-[selected=true]:bg-selected"
            >
              <span className="font-semibold text-foreground">作る</span>
              <span className="truncate">{newPath}</span>
            </Cmdk.Item>
          )}
          {results.length === 0 && !newPath && (
            <p className="px-3 py-2 text-muted-foreground">メモの名前を打ってください</p>
          )}
        </Cmdk.List>
      </Cmdk>
    </OverlayPanel>
  )
}
