import { useCommandStore } from '@/features/commands/stores/command-store'
import { keyLabel } from '@/features/commands/utils/key-label'

const ITEMS: { ids: string[]; label: string }[] = [
  { ids: ['sidebar.down', 'sidebar.up'], label: '移動' },
  { ids: ['sidebar.open'], label: '開く' },
  { ids: ['sidebar.toggle'], label: '開閉' },
  { ids: ['sidebar.close'], label: '閉じる' },
  { ids: ['sidebar.newNote'], label: '作る' },
  { ids: ['sidebar.rename'], label: '名前' },
  { ids: ['sidebar.move'], label: '移動' },
  { ids: ['sidebar.trash'], label: '削除' },
  { ids: ['sidebar.yank'], label: 'コピー' },
  { ids: ['sidebar.paste'], label: '貼る' },
  { ids: ['app.focusEditor'], label: 'エディタへ' },
]

/** サイドバーにフォーカスがある間、下端に出す次のキーの案内 */
export function SidebarKeyGuide() {
  const commands = useCommandStore((s) => s.commands)
  const parts = ITEMS.flatMap(({ ids, label }) => {
    const keys = ids.flatMap((id) => keyLabel(commands, id, 'sidebar') ?? [])
    return keys.length > 0 ? [`${keys.join(' ')} ${label}`] : []
  })
  if (parts.length === 0) {
    return null
  }
  return (
    <p className="border-t border-border-hairline px-4 py-2 text-2xs text-muted-foreground">
      {parts.join(' · ')}
    </p>
  )
}
