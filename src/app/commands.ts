import { open } from '@tauri-apps/plugin-dialog'
import { useCommandStore } from '@/features/commands/stores/command-store'
import { editorCommands } from '@/features/editor/commands'
import { treeCommands } from '@/features/tree/commands'
import { useTreeStore } from '@/features/tree/stores/tree-store'
import { vaultDefaultDir } from '@/features/vault/api/vault'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import { displayName, parentDir, toNotePath, visibleRows } from '@/features/vault/utils/file-tree'
import type { Command } from '@/lib/command'
import { useModeStore } from '@/stores/mode-store'
import { useStatusStore } from '@/stores/status-store'
import { focusEditor, focusSidebar, rememberFocus } from './focus'
import { notes } from './note-controller'
import { useUiStore } from './ui-store'

export async function pickVault(): Promise<void> {
  let defaultPath: string | undefined
  try {
    defaultPath = (await vaultDefaultDir()) ?? undefined
  } catch (error) {
    console.error('iCloud Drive の場所を調べられませんでした', error)
  }
  const path = await open({ directory: true, defaultPath, title: '保管庫にするフォルダを選ぶ' })
  if (typeof path === 'string') {
    await notes.openVault(path)
  }
}

/** ファイル操作の対象。サイドバーにフォーカスがあれば選んでいる行、なければ開いているメモ */
function targetNote(): string | null {
  const vault = useVaultStore.getState()
  if (useModeStore.getState().focus === 'sidebar') {
    const cursor = vault.entries.find((e) => e.path === vault.cursor)
    return cursor?.kind === 'note' ? cursor.path : null
  }
  return vault.openPath
}

function ask(
  title: string,
  initial: string | null,
  confirmLabel: string,
  submit: (v: string) => void,
) {
  rememberFocus()
  useUiStore.getState().setPrompt({ title, initial, confirmLabel, submit })
}

function newNote(): void {
  const vault = useVaultStore.getState()
  const cursor = vault.cursor
  const cursorEntry = vault.entries.find((e) => e.path === cursor)
  let dir = ''
  if (useModeStore.getState().focus === 'sidebar' && cursor) {
    dir = cursorEntry?.kind === 'dir' ? cursor : parentDir(cursor)
  }
  ask('新しいメモの名前', dir ? `${dir}/` : '', '作る', (value) => {
    const path = toNotePath(value)
    if (!path) {
      useStatusStore.getState().show('使えない名前です')
      return
    }
    void notes.createNote(path)
  })
}

function renameNote(move: boolean): void {
  const from = targetNote()
  if (!from) {
    useStatusStore.getState().show('対象のメモがありません')
    return
  }
  const dir = parentDir(from)
  const initial = move ? from : `${displayName(from)}.md`
  ask(move ? '移動先のパス' : '新しい名前', initial, move ? '移す' : '変える', (value) => {
    const to = toNotePath(move || !dir ? value : `${dir}/${value}`)
    if (!to) {
      useStatusStore.getState().show('使えない名前です')
      return
    }
    void notes.renameNote(from, to)
  })
}

function trashNote(): void {
  const path = targetNote()
  if (!path) {
    useStatusStore.getState().show('対象のメモがありません')
    return
  }
  ask(`「${displayName(path)}」をゴミ箱に入れますか`, null, 'ゴミ箱に入れる', () => {
    void notes.trashNote(path)
  })
}

function openOverlay(overlay: 'palette' | 'keys'): void {
  const store = useCommandStore.getState()
  if (store.overlay === overlay) {
    store.setOverlay(null)
    return
  }
  rememberFocus()
  store.setOverlay(overlay)
}

function openSwitcher(): void {
  rememberFocus()
  useVaultStore.getState().setSwitcherOpen(true)
}

function sidebarCommand(id: string, title: string, sequences: string[], run: () => void): Command {
  return {
    id,
    title,
    keys: sequences.map((sequence) => ({ scope: 'sidebar', sequence })),
    run,
  }
}

function openCursor(): void {
  const vault = useVaultStore.getState()
  const row = visibleRows(vault.entries, vault.expanded).find((r) => r.path === vault.cursor)
  if (!row) {
    return
  }
  if (row.kind === 'dir') {
    vault.toggleDir(row.path, true)
  } else {
    void notes.openNote(row.path)
  }
}

function closeCursor(): void {
  const vault = useVaultStore.getState()
  const row = visibleRows(vault.entries, vault.expanded).find((r) => r.path === vault.cursor)
  if (!row) {
    return
  }
  if (row.kind === 'dir' && row.expanded) {
    vault.toggleDir(row.path, false)
  } else if (parentDir(row.path)) {
    vault.setCursor(parentDir(row.path))
  }
}

const hasVault = () => useVaultStore.getState().vault !== null

const appCommands: Command[] = [
  {
    id: 'app.palette',
    title: 'コマンドパレット',
    keys: [
      { scope: 'global', sequence: '⌘K' },
      { scope: 'normal', sequence: '<Space><Space>' },
    ],
    run: () => openOverlay('palette'),
  },
  {
    id: 'vault.switcher',
    title: 'メモを開く（クイックスイッチャー）',
    keys: [
      { scope: 'global', sequence: '⌘P' },
      { scope: 'normal', sequence: '<Space>ff' },
    ],
    when: hasVault,
    run: openSwitcher,
  },
  {
    id: 'vault.newNote',
    title: '新しいメモ',
    keys: [
      { scope: 'global', sequence: '⌘N' },
      { scope: 'normal', sequence: '<Space>fn' },
    ],
    when: hasVault,
    run: newNote,
  },
  {
    id: 'vault.rename',
    title: '名前を変える',
    keys: [{ scope: 'normal', sequence: '<Space>fr' }],
    when: hasVault,
    run: () => renameNote(false),
  },
  {
    id: 'vault.move',
    title: '移動する',
    keys: [{ scope: 'normal', sequence: '<Space>fm' }],
    when: hasVault,
    run: () => renameNote(true),
  },
  {
    id: 'vault.trash',
    title: '削除する（ゴミ箱へ）',
    keys: [{ scope: 'normal', sequence: '<Space>fd' }],
    when: hasVault,
    run: trashNote,
  },
  {
    id: 'vault.reload',
    title: 'メモの一覧を読み直す',
    when: hasVault,
    run: () => void notes.refresh(),
  },
  {
    id: 'note.save',
    title: '保存する',
    keys: [{ scope: 'normal', sequence: ':w', passive: true }],
    when: () => useVaultStore.getState().openPath !== null,
    run: () => void notes.flush(),
  },
  {
    id: 'note.keepMine',
    title: '衝突: 手元の版を残す',
    when: () => useVaultStore.getState().session.saveState === 'conflict',
    run: () => void notes.keepMine(),
  },
  {
    id: 'note.takeTheirs',
    title: '衝突: 外の版を読み込む',
    when: () => useVaultStore.getState().session.saveState === 'conflict',
    run: () => notes.takeTheirs(),
  },
  {
    id: 'app.toggleSidebar',
    title: 'サイドバーの表示を切り替える',
    keys: [{ scope: 'global', sequence: '⌘\\' }],
    run: () => {
      const ui = useUiStore.getState()
      ui.setSidebarVisible(!ui.sidebarVisible)
      if (ui.sidebarVisible) {
        focusEditor()
      }
    },
  },
  {
    id: 'app.keyList',
    title: 'キー操作の一覧',
    keys: [
      { scope: 'global', sequence: '⌘/' },
      { scope: 'normal', sequence: '<Space>?' },
    ],
    run: () => openOverlay('keys'),
  },
  {
    id: 'app.settings',
    title: '保管庫を選び直す（設定）',
    keys: [{ scope: 'global', sequence: '⌘,' }],
    run: () => void pickVault(),
  },
  {
    id: 'app.hints',
    title: 'ヒント（押せる要素にラベルを出す）',
    keys: [{ scope: 'normal', sequence: '<Space>j' }],
    run: () => useCommandStore.getState().setHintTarget('[data-hint]'),
  },
  {
    id: 'app.focusSidebar',
    title: 'サイドバーへ移る',
    keys: [
      { scope: 'normal', sequence: '<Space>e' },
      { scope: 'normal', sequence: '<C-w>h' },
    ],
    run: focusSidebar,
  },
  {
    id: 'app.focusEditor',
    title: 'エディタへ移る',
    keys: [
      { scope: 'normal', sequence: '<C-w>l' },
      { scope: 'sidebar', sequence: 'Esc' },
    ],
    run: focusEditor,
  },
  {
    id: 'tree.toggleKeyGuide',
    title: 'TREE モードの次のキーの案内を切り替える',
    run: () => {
      const tree = useTreeStore.getState()
      tree.setShowKeyGuide(!tree.showKeyGuide)
    },
  },
  {
    id: 'tree.hint',
    title: 'ヒント（ノードへ飛ぶ）',
    keys: [{ scope: 'tree', sequence: 'f' }],
    when: () => useModeStore.getState().tree,
    run: () =>
      useCommandStore.getState().setHintTarget('[data-tree-active="true"] [data-tree-node]'),
  },
  sidebarCommand('sidebar.down', '次の項目へ', ['j'], () => useVaultStore.getState().moveCursor(1)),
  sidebarCommand('sidebar.up', '前の項目へ', ['k'], () => useVaultStore.getState().moveCursor(-1)),
  sidebarCommand('sidebar.open', 'フォルダを開く / メモを開く', ['l', 'Enter'], openCursor),
  sidebarCommand('sidebar.close', 'フォルダを閉じる / 親へ', ['h'], closeCursor),
  sidebarCommand('sidebar.first', '最初の項目へ', ['gg'], () =>
    useVaultStore.getState().moveCursor(-Infinity),
  ),
  sidebarCommand('sidebar.last', '最後の項目へ', ['G'], () =>
    useVaultStore.getState().moveCursor(Infinity),
  ),
]

export function registerCommands(): void {
  useCommandStore
    .getState()
    .register([...appCommands, ...editorCommands, ...treeCommands], { f: 'ファイル', t: 'ツリー' })
}
