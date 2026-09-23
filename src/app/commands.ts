import { open } from '@tauri-apps/plugin-dialog'
import { useCommandStore } from '@/features/commands/stores/command-store'
import {
  applyKeyOverrides,
  diffKeyOverrides,
  type KeyOverrides,
  parseKeyOverrides,
} from '@/features/commands/utils/key-overrides'
import { editorCommands } from '@/features/editor/commands'
import { treeCommands } from '@/features/tree/commands'
import { useTreeStore } from '@/features/tree/stores/tree-store'
import { vaultDefaultDir, vaultFrontMatters } from '@/features/vault/api/vault'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import { displayName, parentDir, toNotePath, visibleRows } from '@/features/vault/utils/file-tree'
import { buildTagIndex } from '@/features/vault/utils/tag-index'
import type { Command, CommandContext } from '@/lib/command'
import { THEMES } from '@/lib/theme'
import { useModeStore } from '@/stores/mode-store'
import { useStatusStore } from '@/stores/status-store'
import { useThemeStore } from '@/stores/theme-store'
import { focusEditor, focusSidebar, rememberFocus } from './focus'
import { openKeybindings, readKeybindings, writeKeybindings } from './keybindings'
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

/**
 * タグ検索を開く。tag を渡せば、そのタグのメモの一覧から始める。開くたびに全メモの
 * フロントマターを読み直す（開いているメモは先に書いておく）
 */
export async function openTagSearch(tag: string | null = null): Promise<void> {
  const vault = useVaultStore.getState()
  if (!vault.tagSearch) {
    rememberFocus()
  }
  vault.setTags(null)
  vault.setTagSearch({ tag })
  try {
    await notes.flush()
    vault.setTags(buildTagIndex(await vaultFrontMatters()))
  } catch (error) {
    console.error('タグを読めませんでした', error)
    useStatusStore.getState().show('タグを読めませんでした')
    vault.setTagSearch(null)
  }
}

function sidebarCommand(id: string, title: string, sequences: string[], run: () => void): Command {
  return {
    id,
    title,
    keys: sequences.map((sequence) => ({ scope: 'sidebar', sequence })),
    run,
  }
}

/** メモなら開く。フォルダは toggle なら開閉を入れ替え、そうでなければ開く */
function openCursor(toggle: boolean): void {
  const vault = useVaultStore.getState()
  const row = visibleRows(vault.entries, vault.expanded).find((r) => r.path === vault.cursor)
  if (!row) {
    return
  }
  if (row.kind === 'dir') {
    vault.toggleDir(row.path, toggle ? !row.expanded : true)
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
  } else if (useUiStore.getState().sidebarSide === 'right') {
    // 右のサイドバーでは h が本文の向き。閉じるものも親も無ければ本文へ移る
    focusEditor()
  }
}

type Direction = 'left' | 'right'

/** 今フォーカスのある領域から見て、その向きにある領域へ移る関数。何も無ければ null */
function paneToward(direction: Direction): (() => void) | null {
  const focus = useModeStore.getState().focus
  const sidebarOnLeft = useUiStore.getState().sidebarSide === 'left'
  const towardSidebar = sidebarOnLeft ? 'left' : 'right'
  if (focus === 'editor' && direction === towardSidebar) {
    return focusSidebar
  }
  if (focus === 'sidebar' && direction !== towardSidebar) {
    return focusEditor
  }
  return null
}

/**
 * 本文の行頭で h（行末で l）を押したとき、その先にサイドバーがあれば移る。
 * 押し続けて行頭を行き過ぎたときに移らないよう、自動の繰り返しでは効かせない。
 */
function atEdgeToward(direction: Direction, ctx: CommandContext): boolean {
  const ui = useUiStore.getState()
  if (ctx.repeat || !ctx.view || !ui.sidebarVisible || paneToward(direction) !== focusSidebar) {
    return false
  }
  const head = ctx.view.state.selection.main.head
  const line = ctx.view.state.doc.lineAt(head)
  return direction === 'left' ? head === line.from : head >= Math.max(line.from, line.to - 1)
}

export function openSettings(): void {
  const ui = useUiStore.getState()
  if (ui.settingsOpen) {
    ui.setSettingsOpen(false)
    return
  }
  rememberFocus()
  ui.setSettingsOpen(true)
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
    id: 'vault.tagSearch',
    title: 'タグで探す',
    keys: [{ scope: 'normal', sequence: '<Space>ft' }],
    when: hasVault,
    run: () => void openTagSearch(),
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
    title: '設定',
    keys: [{ scope: 'global', sequence: '⌘,' }],
    run: openSettings,
  },
  {
    id: 'vault.pick',
    title: '保管庫を選び直す',
    run: () => void pickVault(),
  },
  {
    id: 'app.toggleSidebarSide',
    title: 'サイドバーを左右に置き換える',
    run: () => {
      const ui = useUiStore.getState()
      ui.setSidebarSide(ui.sidebarSide === 'left' ? 'right' : 'left')
    },
  },
  {
    id: 'app.editKeybindings',
    title: 'キーの割り当てを変える（keybindings.json を開く）',
    run: () =>
      void openKeybindings().catch((error: unknown) => {
        console.error('keybindings.json を開けませんでした', error)
        useStatusStore.getState().show('keybindings.json を開けませんでした')
      }),
  },
  {
    id: 'app.reloadKeybindings',
    title: 'キーの割り当てを読み直す',
    run: () => void loadKeybindings(true),
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
    keys: [{ scope: 'global', sequence: '⌘0' }],
    run: focusSidebar,
  },
  {
    id: 'app.focusEditor',
    title: 'エディタへ移る',
    keys: [
      { scope: 'global', sequence: '⌘1' },
      { scope: 'sidebar', sequence: 'Esc' },
    ],
    run: focusEditor,
  },
  {
    id: 'app.toggleFocus',
    title: 'サイドバーとエディタを行き来する',
    keys: [
      { scope: 'normal', sequence: '<Space>e' },
      { scope: 'normal', sequence: '<C-w>w' },
      { scope: 'normal', sequence: '<C-w><C-w>' },
    ],
    run: () => {
      if (useModeStore.getState().focus === 'sidebar') {
        focusEditor()
      } else {
        focusSidebar()
      }
    },
  },
  {
    id: 'app.focusLeft',
    title: '左の領域へ移る',
    keys: [{ scope: 'normal', sequence: '<C-w>h' }],
    when: () => paneToward('left') !== null,
    run: () => paneToward('left')?.(),
  },
  {
    id: 'app.focusRight',
    title: '右の領域へ移る',
    keys: [{ scope: 'normal', sequence: '<C-w>l' }],
    when: () => paneToward('right') !== null,
    run: () => paneToward('right')?.(),
  },
  {
    id: 'app.edgeLeft',
    title: '行頭から左のサイドバーへ移る',
    keys: [{ scope: 'normal', sequence: 'h' }],
    when: (ctx) => atEdgeToward('left', ctx),
    run: focusSidebar,
  },
  {
    id: 'app.edgeRight',
    title: '行末から右のサイドバーへ移る',
    keys: [{ scope: 'normal', sequence: 'l' }],
    when: (ctx) => atEdgeToward('right', ctx),
    run: focusSidebar,
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
  sidebarCommand('sidebar.open', 'フォルダを開く / メモを開く', ['l'], () => openCursor(false)),
  sidebarCommand('sidebar.toggle', 'フォルダを開閉する / メモを開く', ['Enter'], () =>
    openCursor(true),
  ),
  sidebarCommand('sidebar.close', 'フォルダを閉じる / 親へ', ['h'], closeCursor),
  sidebarCommand('sidebar.first', '最初の項目へ', ['gg'], () =>
    useVaultStore.getState().moveCursor(-Infinity),
  ),
  sidebarCommand('sidebar.last', '最後の項目へ', ['G'], () =>
    useVaultStore.getState().moveCursor(Infinity),
  ),
]

const themeCommands: Command[] = THEMES.map((theme) => ({
  id: `app.theme.${theme.id}`,
  title: `テーマ: ${theme.label}`,
  when: () => useThemeStore.getState().theme !== theme.id,
  run: () => useThemeStore.getState().setTheme(theme.id),
}))

/** 上書きを重ねる前の、既定の割り当てのコマンド */
export const defaultCommands: readonly Command[] = [
  ...appCommands,
  ...themeCommands,
  ...editorCommands,
  ...treeCommands,
]

let keyOverrides: KeyOverrides = {}

export function currentKeyOverrides(): KeyOverrides {
  return keyOverrides
}

function registerCommands(overrides: KeyOverrides): string[] {
  keyOverrides = overrides
  const { commands, unknown } = applyKeyOverrides(defaultCommands, overrides)
  useCommandStore.getState().register(commands, { f: 'ファイル', t: 'ツリー' })
  return unknown
}

export function registerDefaultCommands(): void {
  registerCommands({})
}

let lastKeybindings: string | null | undefined

/**
 * keybindings.json を読み、コマンドの割り当てに重ねて登録し直す。前に読んだものと同じなら
 * 何もしない（ウィンドウに戻るたびに呼ぶため）。読めなければ今の割り当てを残す。
 */
export async function loadKeybindings(force = false): Promise<void> {
  let json: string | null
  try {
    json = await readKeybindings()
  } catch (error) {
    console.error('keybindings.json を読めませんでした', error)
    return
  }
  if (!force && json === lastKeybindings) {
    return
  }
  lastKeybindings = json
  const status = useStatusStore.getState()
  const parsed = json ? parseKeyOverrides(json) : { ok: true as const, overrides: {} }
  if (!parsed.ok) {
    console.error('keybindings.json を読めませんでした', parsed.error)
    status.show(`keybindings.json を読めませんでした · ${parsed.error}`)
    return
  }
  const unknown = registerCommands(parsed.overrides)
  if (unknown.length > 0) {
    status.show(`keybindings.json に無いコマンドがあります · ${unknown.join(', ')}`)
  } else if (force) {
    status.show('キーの割り当てを読み直しました')
  }
}

/**
 * 設定画面で変えた割り当てを keybindings.json に書き、すぐに効かせる。
 * 既定のコマンドに無い ID（手で書いたもの）は消さずに残す。
 */
export async function saveKeyOverrides(edited: KeyOverrides): Promise<void> {
  const known = new Set(defaultCommands.map((c) => c.id))
  const kept = Object.fromEntries(Object.entries(keyOverrides).filter(([id]) => !known.has(id)))
  const next = { ...kept, ...diffKeyOverrides(defaultCommands, edited) }
  registerCommands(next)
  const json = `${JSON.stringify(next, null, 2)}\n`
  lastKeybindings = json
  try {
    await writeKeybindings(json)
  } catch (error) {
    console.error('keybindings.json に書けませんでした', error)
    useStatusStore.getState().show('キーの割り当てを保存できませんでした')
  }
}
