import { useEffect, useState, useSyncExternalStore } from 'react'
import { SidebarKeyGuide } from '@/components/layouts/sidebar-key-guide'
import { StatusBar } from '@/components/layouts/status-bar'
import { PromptDialog } from '@/components/ui/prompt-dialog'
import { CommandPalette } from '@/features/commands/components/command-palette'
import { Hints } from '@/features/commands/components/hints'
import { KeyList } from '@/features/commands/components/key-list'
import { WhichKey } from '@/features/commands/components/which-key'
import { useKeyDispatcher } from '@/features/commands/hooks/use-key-dispatcher'
import { useCommandStore } from '@/features/commands/stores/command-store'
import { keyLabel } from '@/features/commands/utils/key-label'
import { Editor, type EditorHandle } from '@/features/editor/components/editor'
import { setExHandlers } from '@/features/editor/extensions/vim-bridge'
import { TreeFullscreen } from '@/features/tree/components/tree-fullscreen'
import { treeExtension } from '@/features/tree/extensions/tree-extension'
import { useTreeStore } from '@/features/tree/stores/tree-store'
import { onVaultChanged } from '@/features/vault/api/vault'
import { FileTree } from '@/features/vault/components/file-tree'
import { QuickSwitcher } from '@/features/vault/components/quick-switcher'
import { SessionBanner } from '@/features/vault/components/session-banner'
import { VaultPicker } from '@/features/vault/components/vault-picker'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import { toNotePath } from '@/features/vault/utils/file-tree'
import { cn } from '@/lib/cn'
import { applyTheme } from '@/lib/theme'
import { useModeStore } from '@/stores/mode-store'
import { useThemeStore } from '@/stores/theme-store'
import { loadKeybindings, pickVault, registerDefaultCommands } from './commands'
import { focusEditor, restoreFocus, trackFocus } from './focus'
import { clearStatusMessage, getContext, getScopes, replayKeys, swallowKey } from './keys'
import { notes } from './note-controller'
import { loadPersistedState, updatePersistedState } from './persisted-state'
import { SettingsScreen } from './settings-screen'
import { type SidebarSide, useUiStore } from './ui-store'

/** Editor に渡す拡張。作り直すとエディタごと作り直しになるので、ここで 1 度だけ作る */
const editorExtensions = [treeExtension(), notes.extension]

let editorView: EditorHandle['view'] | null = null
const viewListeners = new Set<() => void>()

function attachEditor(handle: EditorHandle | null): void {
  notes.attach(handle)
  editorView = handle?.view ?? null
  for (const listener of viewListeners) {
    listener()
  }
}

function openByName(name: string): void {
  const path = toNotePath(name)
  if (!path) {
    return
  }
  const exists = useVaultStore.getState().entries.some((e) => e.path === path)
  void (exists ? notes.openNote(path) : notes.createNote(path))
}

function subscribeEditorView(listener: () => void): () => void {
  viewListeners.add(listener)
  return () => {
    viewListeners.delete(listener)
  }
}

function useEditorView(): EditorHandle['view'] | null {
  return useSyncExternalStore(subscribeEditorView, () => editorView)
}

function gridColumns(sidebarVisible: boolean, side: SidebarSide): string {
  if (!sidebarVisible) {
    return 'minmax(0, 1fr)'
  }
  return side === 'left' ? '240px minmax(0, 1fr)' : 'minmax(0, 1fr) 240px'
}

async function boot(): Promise<void> {
  const state = await loadPersistedState()
  useUiStore.getState().setSidebarVisible(state.sidebarVisible)
  useUiStore.getState().setSidebarSide(state.sidebarSide)
  useTreeStore.getState().setPreferFullscreen(state.preferFullscreen)
  useTreeStore.getState().setShowKeyGuide(state.showKeyGuide)
  useThemeStore.getState().setTheme(state.theme)
  applyTheme(state.theme)
  useThemeStore.subscribe((theme, prev) => {
    if (theme.theme !== prev.theme) {
      applyTheme(theme.theme)
      updatePersistedState((s) => ({ ...s, theme: theme.theme }))
    }
  })
  useVaultStore.subscribe((vault, prev) => {
    if (vault.cursor && vault.cursor !== prev.cursor) {
      notes.prefetch(vault.cursor)
    }
  })
  useUiStore.subscribe((ui, prev) => {
    if (ui.sidebarVisible !== prev.sidebarVisible || ui.sidebarSide !== prev.sidebarSide) {
      updatePersistedState((s) => ({
        ...s,
        sidebarVisible: ui.sidebarVisible,
        sidebarSide: ui.sidebarSide,
      }))
    }
  })
  useTreeStore.subscribe((tree, prev) => {
    if (
      tree.preferFullscreen !== prev.preferFullscreen ||
      tree.showKeyGuide !== prev.showKeyGuide
    ) {
      updatePersistedState((s) => ({
        ...s,
        preferFullscreen: tree.preferFullscreen,
        showKeyGuide: tree.showKeyGuide,
      }))
    }
  })
  await loadKeybindings()
  if (state.lastVault) {
    await notes.openVault(state.lastVault)
  }
}

export function App() {
  const [ready, setReady] = useState(false)
  const vault = useVaultStore((s) => s.vault)
  const openPath = useVaultStore((s) => s.openPath)
  const switcherOpen = useVaultStore((s) => s.switcherOpen)
  const sidebarVisible = useUiStore((s) => s.sidebarVisible)
  const sidebarSide = useUiStore((s) => s.sidebarSide)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const prompt = useUiStore((s) => s.prompt)
  const focus = useModeStore((s) => s.focus)
  const commands = useCommandStore((s) => s.commands)
  const view = useEditorView()
  const hint = (id: string, label: string) => {
    const key = keyLabel(commands, id)
    return key ? `${key} で${label}` : null
  }

  useKeyDispatcher({
    getScopes,
    getContext,
    replay: replayKeys,
    swallow: swallowKey,
    onKey: clearStatusMessage,
  })

  useEffect(() => {
    registerDefaultCommands()
    setExHandlers({ write: () => void notes.flush(), edit: openByName })
    void boot().finally(() => setReady(true))
    const unlisten = onVaultChanged((paths) => void notes.onVaultChanged(paths)).catch(
      (error: unknown) => {
        console.error('保管庫の変更を受け取れません', error)
        return () => undefined
      },
    )
    const onBlur = () => void notes.flush()
    // keybindings.json は外のエディタで書くので、戻ってきたときに読み直す
    const onFocus = () => void loadKeybindings()
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      setExHandlers(null)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      void unlisten.then((stop) => stop())
    }
  }, [])

  return (
    <div
      className="grid h-dvh grid-rows-[1fr_auto] text-base"
      onFocus={(event) => trackFocus(event.target)}
    >
      <div
        className="grid min-h-0"
        style={{ gridTemplateColumns: gridColumns(sidebarVisible, sidebarSide) }}
      >
        {sidebarVisible && (
          <aside
            data-sidebar=""
            // サイドバーはキー入力の受け口。行ごとではなく領域にフォーカスを置く
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 上のとおり
            tabIndex={0}
            aria-label="サイドバー"
            className={cn(
              'relative flex min-h-0 flex-col border-border',
              sidebarSide === 'left' ? 'border-r' : 'order-last border-l',
            )}
            // globals.css のフォーカスリングはレイヤーの外にあり、クラスでは消せない。領域のフォーカスは上端の線で示す
            style={{ outline: 'none' }}
          >
            {focus === 'sidebar' && <div className="absolute inset-x-0 top-0 h-0.5 bg-ring" />}
            <header className="flex h-10 items-center px-4 text-xs font-semibold text-subtle-foreground">
              <span className="truncate">{vault?.name.normalize('NFC')}</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FileTree
                focused={focus === 'sidebar'}
                emptyHint={hint('vault.newNote', '作る')}
                onOpen={(path) => void notes.openNote(path)}
              />
            </div>
            {focus === 'sidebar' && <SidebarKeyGuide />}
          </aside>
        )}
        <main data-editor-pane="" className="relative flex min-h-0 flex-col">
          {focus === 'editor' && <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-ring" />}
          <SessionBanner
            onKeepMine={() => void notes.keepMine()}
            onTakeTheirs={() => notes.takeTheirs()}
          />
          <div className={cn('min-h-0 flex-1', !openPath && 'invisible')}>
            <Editor extensions={editorExtensions} onReady={attachEditor} />
          </div>
          {!openPath && vault && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <p>
                {[
                  'メモを開いていません',
                  hint('vault.switcher', '開く'),
                  hint('vault.newNote', '作る'),
                  hint('app.focusSidebar', 'サイドバーへ'),
                  hint('app.keyList', 'キー操作の一覧'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}
          <TreeFullscreen view={view} />
          <WhichKey getContext={getContext} getScopes={getScopes} />
        </main>
      </div>
      <StatusBar />
      <CommandPalette getContext={getContext} restoreFocus={restoreFocus} />
      <KeyList restoreFocus={restoreFocus} />
      {switcherOpen && (
        <QuickSwitcher
          onOpen={(path) => void notes.openNote(path)}
          onCreate={(path) => void notes.createNote(path)}
          onClose={() => {
            useVaultStore.getState().setSwitcherOpen(false)
            restoreFocus()
          }}
        />
      )}
      {prompt && (
        <PromptDialog
          title={prompt.title}
          initial={prompt.initial}
          confirmLabel={prompt.confirmLabel}
          onSubmit={(value) => {
            useUiStore.getState().setPrompt(null)
            restoreFocus()
            prompt.submit(value)
          }}
          onCancel={() => {
            useUiStore.getState().setPrompt(null)
            restoreFocus()
          }}
        />
      )}
      {settingsOpen && (
        <SettingsScreen
          onClose={() => {
            useUiStore.getState().setSettingsOpen(false)
            restoreFocus()
          }}
        />
      )}
      <Hints />
      {ready && !vault && (
        <div className="fixed inset-0 z-50 bg-background">
          <VaultPicker onPick={() => void pickVault().then(focusEditor)} />
        </div>
      )}
    </div>
  )
}
