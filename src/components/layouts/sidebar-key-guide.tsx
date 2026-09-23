import { useCommandStore } from '@/features/commands/stores/command-store'
import { keyLabel } from '@/features/commands/utils/key-label'

const ITEMS: { ids: string[]; label: string }[] = [
  { ids: ['sidebar.down', 'sidebar.up'], label: '移動' },
  { ids: ['sidebar.open'], label: '開く' },
  { ids: ['sidebar.toggle'], label: '開閉' },
  { ids: ['sidebar.close'], label: '閉じる' },
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
