import { useEffect, useState, useSyncExternalStore } from 'react'
import { SidebarKeyGuide } from '@/components/layouts/sidebar-key-guide'
import { StatusBar } from '@/components/layouts/status-bar'
import { PromptDialog } from '@/components/ui/prompt-dialog'
import { useHeld, usePresence } from '@/components/ui/use-presence'
import { CommandPalette } from '@/features/commands/components/command-palette'
import { Hints } from '@/features/commands/components/hints'
import { KeyList } from '@/features/commands/components/key-list'
import { WhichKey } from '@/features/commands/components/which-key'
import { useKeyDispatcher } from '@/features/commands/hooks/use-key-dispatcher'
import { useCommandStore } from '@/features/commands/stores/command-store'
import { keyLabel } from '@/features/commands/utils/key-label'
import { Editor, type EditorHandle } from '@/features/editor/components/editor'
import { tagClickHandler } from '@/features/editor/extensions/front-matter'
import { noteTitleClickHandler } from '@/features/editor/extensions/note-title'
import { applyVimConfig, setExHandlers } from '@/features/editor/extensions/vim-bridge'
import { TreeFullscreen } from '@/features/tree/components/tree-fullscreen'
import { treeExtension } from '@/features/tree/extensions/tree-extension'
import { useTreeStore } from '@/features/tree/stores/tree-store'
import { onVaultChanged } from '@/features/vault/api/vault'
import { FileTree } from '@/features/vault/components/file-tree'
import { QuickSwitcher } from '@/features/vault/components/quick-switcher'
import { SessionBanner } from '@/features/vault/components/session-banner'
import { TagSearch } from '@/features/vault/components/tag-search'
import { VaultPicker } from '@/features/vault/components/vault-picker'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import { toNotePath } from '@/features/vault/utils/file-tree'
import { cn } from '@/lib/cn'
import { applyFontFamily, sanitizeFontFamily } from '@/lib/font-family'
import { applyFontSize, sanitizeFontSize } from '@/lib/font-size'
import { applyTheme, resolveTheme, sanitizeCustomThemes } from '@/lib/theme'
import { useModeStore } from '@/stores/mode-store'
import { useThemeStore } from '@/stores/theme-store'
import {
  loadKeybindings,
  openSettings,
  openTagSearch,
  pickVault,
  registerDefaultCommands,
  renameNote,
} from './commands'
import { focusEditor, restoreFocus, trackFocus } from './focus'
import { clearStatusMessage, getContext, getScopes, replayKeys, swallowKey } from './keys'
import { notes } from './note-controller'
import { loadPersistedState, updatePersistedState } from './persisted-state'
import { SettingsScreen } from './settings-screen'
import { type SidebarSide, useUiStore } from './ui-store'

/** Editor に渡す拡張。作り直すとエディタごと作り直しになるので、ここで 1 度だけ作る */
const editorExtensions = [
  treeExtension(),
  notes.extension,
  tagClickHandler.of((tag) => void openTagSearch(tag)),
  noteTitleClickHandler.of(() => renameNote(false, useVaultStore.getState().openPath)),
]

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

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
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
  useUiStore.getState().setFontSize(sanitizeFontSize(state.fontSize))
  applyFontSize(useUiStore.getState().fontSize)
  useUiStore.getState().setFontFamily(sanitizeFontFamily(state.fontFamily))
  applyFontFamily(useUiStore.getState().fontFamily)
  useTreeStore.getState().setPreferFullscreen(state.preferFullscreen)
  useTreeStore.getState().setShowKeyGuide(state.showKeyGuide)
  const customThemes = sanitizeCustomThemes(state.customThemes)
  useThemeStore.getState().setCustomThemes(customThemes)
  useThemeStore.getState().setTheme(resolveTheme(state.theme, customThemes).id)
  applyTheme(resolveTheme(state.theme, customThemes))
  useThemeStore.subscribe((theme, prev) => {
    if (theme.theme !== prev.theme || theme.customThemes !== prev.customThemes) {
      applyTheme(resolveTheme(theme.theme, theme.customThemes))
      updatePersistedState((s) => ({
        ...s,
        theme: theme.theme,
        customThemes: theme.customThemes,
      }))
    }
  })
  useVaultStore.subscribe((vault, prev) => {
    if (vault.cursor && vault.cursor !== prev.cursor) {
      notes.prefetch(vault.cursor)
    }
  })
  applyVimConfig(state.vim)
  useUiStore.subscribe((ui, prev) => {
    if (ui.fontSize !== prev.fontSize) {
      applyFontSize(ui.fontSize)
    }
    if (ui.fontFamily !== prev.fontFamily) {
      applyFontFamily(ui.fontFamily)
    }
    if (
      ui.sidebarVisible !== prev.sidebarVisible ||
      ui.sidebarSide !== prev.sidebarSide ||
      ui.fontSize !== prev.fontSize ||
      ui.fontFamily !== prev.fontFamily
    ) {
      updatePersistedState((s) => ({
        ...s,
        sidebarVisible: ui.sidebarVisible,
        sidebarSide: ui.sidebarSide,
        fontSize: ui.fontSize,
        fontFamily: ui.fontFamily,
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
  const sidebarVisible = useUiStore((s) => s.sidebarVisible)
  const sidebarSide = useUiStore((s) => s.sidebarSide)
  const settings = usePresence(useUiStore((s) => s.settingsOpen))
  const promptRequest = useUiStore((s) => s.prompt)
  const prompt = useHeld(promptRequest)
  const promptPresence = usePresence(promptRequest !== null)
  const focus = useModeStore((s) => s.focus)
  const commands = useCommandStore((s) => s.commands)
  const view = useEditorView()
  const settingsKey = keyLabel(commands, 'app.settings')
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
      {/* テーマの背景画像（lib/theme.ts の Backdrop）。画像の無いテーマでは何も描かない */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* ぼかすと縁が透けるので、画面より大きく敷いてはみ出た分を切る */}
        <div className="absolute -inset-24 bg-(image:--backdrop-image) bg-cover bg-center blur-(--backdrop-blur)" />
        <div className="absolute inset-0 bg-(--backdrop-veil)" />
      </div>
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
              // 領域のフォーカスはリングではなく上端の線で示す
              'relative flex min-h-0 flex-col border-border bg-(--backdrop-paper) outline-none',
              sidebarSide === 'left' ? 'border-r' : 'order-last border-l',
            )}
          >
            {focus === 'sidebar' && <div className="absolute inset-x-0 top-0 h-0.5 bg-ring" />}
            <header className="flex h-10 items-center gap-2 pr-2 pl-4 text-xs font-semibold text-subtle-foreground">
              <span className="min-w-0 flex-1 truncate">{vault?.name.normalize('NFC')}</span>
              <button
                type="button"
                tabIndex={-1}
                data-hint=""
                aria-label="設定"
                title={settingsKey ? `設定（${settingsKey}）` : '設定'}
                // 押してもフォーカスを動かさない。閉じたときに元の場所へ戻すため
                onMouseDown={(event) => event.preventDefault()}
                onClick={openSettings}
                className="grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <SettingsIcon />
              </button>
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
      <QuickSwitcher
        onOpen={(path) => void notes.openNote(path)}
        onCreate={(path) => void notes.createNote(path)}
        onClose={() => {
          useVaultStore.getState().setSwitcherOpen(false)
          restoreFocus()
        }}
      />
      <TagSearch
        onOpen={(path) => void notes.openNote(path)}
        onClose={() => {
          useVaultStore.getState().setTagSearch(null)
          restoreFocus()
        }}
      />
      {promptPresence.mounted && prompt && (
        <PromptDialog
          title={prompt.title}
          initial={prompt.initial}
          confirmLabel={prompt.confirmLabel}
          closing={promptPresence.closing}
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
      {settings.mounted && (
        <SettingsScreen
          closing={settings.closing}
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
