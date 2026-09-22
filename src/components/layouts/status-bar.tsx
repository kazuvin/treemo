import { useCommandStore } from '@/features/commands/stores/command-store'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import type { SaveState } from '@/features/vault/utils/note-session'
import { formatToken } from '@/lib/keys'
import { modeLabel, useModeStore } from '@/stores/mode-store'
import { useStatusStore } from '@/stores/status-store'

const SAVE_LABELS: Record<SaveState, string> = {
  saved: '保存済み',
  dirty: '未保存',
  saving: '保存中',
  error: '保存できません',
  conflict: '外部の変更と衝突',
}

const FOCUS_LABELS = { sidebar: 'サイドバー', editor: 'エディタ', overlay: '' }

/** モード（F-UX-4）、フォーカスのある領域（F-UX-7）、保存の状態を常に出す */
export function StatusBar() {
  const vim = useModeStore((s) => s.vim)
  const tree = useModeStore((s) => s.tree)
  const nodeEdit = useModeStore((s) => s.nodeEdit)
  const focus = useModeStore((s) => s.focus)
  const pending = useCommandStore((s) => s.pending)
  const message = useStatusStore((s) => s.message)
  const vault = useVaultStore((s) => s.vault)
  const openPath = useVaultStore((s) => s.openPath)
  const saveState = useVaultStore((s) => s.session.saveState)
  return (
    <footer className="flex h-7 items-center gap-4 border-t border-border px-4 text-xs text-subtle-foreground">
      <span
        className={tree ? 'font-bold text-foreground' : 'font-semibold text-foreground'}
        aria-live="polite"
      >
        {modeLabel({ vim, tree, nodeEdit })}
      </span>
      {FOCUS_LABELS[focus] && <span>{FOCUS_LABELS[focus]}</span>}
      {pending.length > 0 && (
        <span className="font-mono text-foreground">{pending.map(formatToken).join('')}</span>
      )}
      {message && (
        <span className="truncate text-foreground" role="status">
          {message}
        </span>
      )}
      <span className="ml-auto truncate">{openPath?.normalize('NFC')}</span>
      {openPath && (
        <span className={saveState === 'saved' ? '' : 'font-semibold text-foreground'}>
          {SAVE_LABELS[saveState]}
        </span>
      )}
      {vault && <span className="text-muted-foreground">{vault.name.normalize('NFC')}</span>}
    </footer>
  )
}
