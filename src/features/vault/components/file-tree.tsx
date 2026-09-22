import { cn } from '@/lib/cn'
import { useVaultStore } from '../stores/vault-store'
import { visibleRows } from '../utils/file-tree'

interface FileTreeProps {
  focused: boolean
  onOpen: (path: string) => void
}

/** サイドバーのファイル一覧（F-VAULT-2）。キーは app が登録したコマンドで動く */
export function FileTree({ focused, onOpen }: FileTreeProps) {
  const entries = useVaultStore((s) => s.entries)
  const expanded = useVaultStore((s) => s.expanded)
  const cursor = useVaultStore((s) => s.cursor)
  const openPath = useVaultStore((s) => s.openPath)
  const toggleDir = useVaultStore((s) => s.toggleDir)
  const setCursor = useVaultStore((s) => s.setCursor)
  const rows = visibleRows(entries, expanded)

  if (rows.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-muted-foreground">メモはまだありません · ⌘N で作る</p>
    )
  }
  return (
    <ul role="tree" aria-label="メモの一覧" className="py-1">
      {rows.map((row) => {
        const isCursor = row.path === cursor
        return (
          // キー操作はサイドバーのコマンド（j / k / l / Enter）で受ける
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- 上のとおり
          <li
            key={row.path}
            role="treeitem"
            aria-selected={isCursor}
            aria-expanded={row.kind === 'dir' ? row.expanded : undefined}
            data-hint=""
            ref={(el) => {
              if (el && isCursor) {
                el.scrollIntoView({ block: 'nearest' })
              }
            }}
            className={cn(
              'flex h-7 cursor-default items-center gap-1 border-l-2 pr-3 text-sm',
              isCursor && focused ? 'border-selected-border bg-selected' : 'border-transparent',
              isCursor && !focused && 'bg-muted',
              row.path === openPath ? 'font-semibold text-foreground' : 'text-subtle-foreground',
            )}
            style={{ paddingLeft: 12 + row.depth * 12 }}
            onClick={() => {
              setCursor(row.path)
              if (row.kind === 'dir') {
                toggleDir(row.path)
              } else {
                onOpen(row.path)
              }
            }}
          >
            <span className="w-3 shrink-0 text-muted-foreground" aria-hidden="true">
              {row.kind === 'dir' && (row.expanded ? '▾' : '▸')}
            </span>
            <span className="truncate">{row.name}</span>
            {row.placeholder && (
              <span className="shrink-0 text-2xs text-muted-foreground">未ダウンロード</span>
            )}
            {row.conflict && (
              <span
                className="shrink-0 text-2xs text-muted-foreground"
                title="iCloud の衝突で作られた可能性があります"
              >
                衝突?
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
