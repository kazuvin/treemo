import { Annotation, Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { EditorHandle } from '@/features/editor/components/editor'
import { foldedLines, restoreFolds } from '@/features/editor/utils/folds'
import { minimalChange } from '@/features/editor/utils/minimal-change'
import { restoreTreeFolds, treeFolds } from '@/features/tree/extensions/tree-actions'
import {
  noteCreate,
  noteRead,
  noteRename,
  noteTrash,
  noteWrite,
  vaultList,
  vaultOpen,
  VaultCommandError,
} from '@/features/vault/api/vault'
import { initialSession, useVaultStore } from '@/features/vault/stores/vault-store'
import { NoteSession } from '@/features/vault/utils/note-session'
import { useStatusStore } from '@/stores/status-store'
import { noteKey, persistedState, setNoteState, updatePersistedState } from './persisted-state'

/** 外の版で置き換えたトランザクション。自動保存を起こさない */
const externalLoad = Annotation.define<boolean>()

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 開いているメモを 1 つ受け持ち、エディタ（正本）と保管庫（ファイル）をつなぐ。
 * feature どうしは import し合えないので、つなぐのは app の役目。
 */
class NoteController {
  private handle: EditorHandle | null = null
  private session: NoteSession | null = null
  private queue: Promise<unknown> = Promise.resolve()

  readonly extension = EditorView.updateListener.of((update) => {
    if (update.docChanged && !update.transactions.some((tr) => tr.annotation(externalLoad))) {
      this.session?.markChanged()
    }
  })

  get view(): EditorView | null {
    return this.handle?.view ?? null
  }

  attach(handle: EditorHandle | null): void {
    this.handle = handle
  }

  /** 読み書きが入れ違わないよう、1 本の列に並べる */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  openVault(path: string): Promise<void> {
    return this.enqueue(async () => {
      await this.closeCurrent()
      const store = useVaultStore.getState()
      try {
        const info = await vaultOpen(path)
        store.setVault(info)
        store.setOpenError(null)
        updatePersistedState((s) => ({ ...s, lastVault: info.root }))
        await this.refreshNow()
        const last = persistedState().lastNote[info.root]
        if (last && useVaultStore.getState().entries.some((e) => e.path === last)) {
          await this.openNow(last)
        }
      } catch (error) {
        console.error('保管庫を開けませんでした', error)
        store.setVault(null)
        store.setOpenError(message(error))
      }
    })
  }

  refresh(): Promise<void> {
    return this.enqueue(() => this.refreshNow())
  }

  private async refreshNow(): Promise<void> {
    try {
      useVaultStore.getState().setEntries(await vaultList())
    } catch (error) {
      console.error('メモの一覧を読めませんでした', error)
      useStatusStore.getState().show(`メモの一覧を読めませんでした: ${message(error)}`)
    }
  }

  openNote(path: string): Promise<void> {
    return this.enqueue(() => this.openNow(path))
  }

  private async openNow(path: string): Promise<void> {
    const store = useVaultStore.getState()
    const handle = this.handle
    if (!handle) {
      return
    }
    if (store.openPath === path) {
      handle.view.focus()
      return
    }
    const entry = store.entries.find((e) => e.path === path)
    if (entry?.placeholder) {
      useStatusStore.getState().show('iCloud からダウンロードしています…')
    }
    let note: { content: string; hash: string }
    try {
      note = await noteRead(path)
    } catch (error) {
      console.error('メモを開けませんでした', error)
      useStatusStore.getState().show(`メモを開けませんでした: ${message(error)}`)
      return
    }
    await this.closeCurrent()
    handle.load(note.content)
    this.session = new NoteSession(
      path,
      note.hash,
      { read: noteRead, write: noteWrite },
      {
        getText: () => handle.view.state.doc.toString(),
        replaceText: (text) => this.replaceText(text),
      },
      (snapshot) => useVaultStore.getState().setSession(snapshot),
    )
    store.setOpenPath(path)
    store.setSession(initialSession)
    store.reveal(path)
    const vault = store.vault
    if (vault) {
      const saved = persistedState().notes[noteKey(vault.root, path)]
      if (saved) {
        restoreTreeFolds(handle.view, saved.treeFolds)
        restoreFolds(handle.view, saved.folds)
      }
      updatePersistedState((s) => ({ ...s, lastNote: { ...s.lastNote, [vault.root]: path } }))
    }
    if (entry?.placeholder) {
      useStatusStore.getState().clear()
      void this.refreshNow()
    }
    // 何も開いていなかった間はエディタの枠が invisible で、ここではまだ描き直されていない。
    // そのまま focus() しても効かないので、描き直したあとに当てる
    requestAnimationFrame(() => handle.view.focus())
  }

  private replaceText(text: string): void {
    const view = this.view
    if (!view) {
      return
    }
    const change = minimalChange(view.state.doc.toString(), text)
    if (change) {
      view.dispatch({
        changes: change,
        annotations: [externalLoad.of(true), Transaction.addToHistory.of(false)],
      })
    }
  }

  private rememberNoteState(): void {
    const vault = useVaultStore.getState().vault
    const view = this.view
    if (!vault || !view || !this.session) {
      return
    }
    setNoteState(noteKey(vault.root, this.session.path), {
      folds: foldedLines(view.state),
      treeFolds: treeFolds(view.state),
    })
  }

  private async closeCurrent(): Promise<void> {
    const session = this.session
    if (!session) {
      return
    }
    this.rememberNoteState()
    await session.flush()
    session.dispose()
    this.session = null
    useVaultStore.getState().setOpenPath(null)
  }

  /** `:w`、ウィンドウのフォーカスが外れたとき */
  flush(): Promise<void> {
    this.rememberNoteState()
    return this.session?.flush() ?? Promise.resolve()
  }

  keepMine(): Promise<void> {
    return this.session?.keepMine() ?? Promise.resolve()
  }

  takeTheirs(): void {
    this.session?.takeTheirs()
  }

  onVaultChanged(paths: readonly string[]): Promise<void> {
    return this.enqueue(async () => {
      await this.refreshNow()
      const session = this.session
      if (session && paths.includes(session.path)) {
        await session.onExternalChange()
      }
    })
  }

  createNote(path: string): Promise<void> {
    return this.enqueue(async () => {
      try {
        await noteCreate(path)
      } catch (error) {
        if (!(error instanceof VaultCommandError && error.kind === 'alreadyExists')) {
          console.error('メモを作れませんでした', error)
          useStatusStore.getState().show(`メモを作れませんでした: ${message(error)}`)
          return
        }
      }
      await this.refreshNow()
      await this.openNow(path)
    })
  }

  renameNote(from: string, to: string): Promise<void> {
    return this.enqueue(async () => {
      if (from === to) {
        return
      }
      const wasOpen = this.session?.path === from
      if (wasOpen) {
        await this.closeCurrent()
      }
      try {
        await noteRename(from, to)
      } catch (error) {
        console.error('名前を変えられませんでした', error)
        useStatusStore.getState().show(`名前を変えられませんでした: ${message(error)}`)
        await this.refreshNow()
        if (wasOpen) {
          await this.openNow(from)
        }
        return
      }
      const vault = useVaultStore.getState().vault
      if (vault) {
        const saved = persistedState().notes[noteKey(vault.root, from)]
        if (saved) {
          setNoteState(noteKey(vault.root, to), saved)
        }
      }
      await this.refreshNow()
      if (wasOpen) {
        await this.openNow(to)
      }
    })
  }

  trashNote(path: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.session?.path === path) {
        await this.closeCurrent()
        this.handle?.load('')
      }
      try {
        await noteTrash(path)
        useStatusStore.getState().show('ゴミ箱に入れました')
      } catch (error) {
        console.error('ゴミ箱に入れられませんでした', error)
        useStatusStore.getState().show(`ゴミ箱に入れられませんでした: ${message(error)}`)
      }
      await this.refreshNow()
    })
  }
}

export const notes = new NoteController()
