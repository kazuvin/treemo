import { Annotation, Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { restoreTreeFolds, treeFolds } from '@/features/diagram/extensions/tree-actions'
import { syncTreeState } from '@/features/diagram/extensions/tree-extension'
import type { EditorHandle } from '@/features/editor/components/editor'
import { vimModeOf } from '@/features/editor/extensions/vim-bridge'
import { foldedLines, restoreFolds } from '@/features/editor/utils/folds'
import { minimalChange } from '@/features/editor/utils/minimal-change'
import {
  noteCreate,
  noteDuplicate,
  noteRead,
  noteRename,
  noteTrash,
  noteWrite,
  vaultList,
  vaultOpen,
  VaultCommandError,
} from '@/features/vault/api/vault'
import { initialSession, useVaultStore } from '@/features/vault/stores/vault-store'
import { displayName, visibleRows } from '@/features/vault/utils/file-tree'
import { NoteCache } from '@/features/vault/utils/note-cache'
import { NoteSession, type SessionSnapshot } from '@/features/vault/utils/note-session'
import { allowWhileReading } from '@/lib/reading'
import { useModeStore } from '@/stores/mode-store'
import { useStatusStore } from '@/stores/status-store'
import { usePaneStore } from './pane-store'
import { noteKey, persistedState, setNoteState, updatePersistedState } from './persisted-state'

/** 外の版で置き換えたトランザクション。自動保存を起こさない */
const externalLoad = Annotation.define<boolean>()

/** 本文を左右に分けられる数（docs/keybindings.md の「本文を分ける」） */
export const MAX_PANES = 2

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 本文の領域 1 つ。エディタと、そこで開いているメモのセッションを持つ */
class Pane {
  handle: EditorHandle | null = null
  session: NoteSession | null = null
  /** 画面に出すメモ。切り替えの途中はセッションが無くても前のメモを指したままにする */
  openPath: string | null = null
  snapshot: SessionSnapshot = initialSession
  readonly ready: Promise<void>
  private resolveReady: () => void = () => undefined

  readonly extension = EditorView.updateListener.of((update) => {
    if (update.docChanged && !update.transactions.some((tr) => tr.annotation(externalLoad))) {
      this.session?.markChanged()
    }
  })

  constructor(readonly key: number) {
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve
    })
  }

  get view(): EditorView | null {
    return this.handle?.view ?? null
  }

  attach(handle: EditorHandle | null): void {
    this.handle = handle
    if (handle) {
      this.resolveReady()
    }
  }
}

/**
 * 開いているメモと保管庫（ファイル）をつなぐ。本文の領域（Pane）ごとにエディタ（正本）を持つ。
 * feature どうしは import し合えないので、つなぐのは app の役目。
 */
class NoteController {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly cache = new NoteCache()
  private nextKey = 0
  private readonly first = new Pane(this.nextKey++)
  private paneList: Pane[] = [this.first]
  private activeIdx = 0

  constructor() {
    this.emit()
  }

  get panes(): readonly Pane[] {
    return this.paneList
  }

  get activeIndex(): number {
    return this.activeIdx
  }

  get active(): Pane {
    return this.paneList[this.activeIdx] ?? this.paneList[0] ?? this.first
  }

  /** キー入力を受ける領域のエディタ */
  get view(): EditorView | null {
    return this.active.view
  }

  isActiveView(view: EditorView): boolean {
    return this.active.view === view
  }

  pane(key: number): Pane | undefined {
    return this.paneList.find((p) => p.key === key)
  }

  attach(key: number, handle: EditorHandle | null): void {
    this.pane(key)?.attach(handle)
  }

  /** フォーカスの入った領域を、キー入力を受ける領域にする */
  activate(key: number): void {
    const index = this.paneList.findIndex((p) => p.key === key)
    if (index === -1 || index === this.activeIdx) {
      return
    }
    this.activeIdx = index
    this.emit()
    this.syncMode()
  }

  /** その領域のエディタにフォーカスを当てる。メモを開いていなければ領域そのものに当てる */
  focusPane(index = this.activeIdx): void {
    const pane = this.paneList[index]
    if (!pane) {
      return
    }
    if (pane.openPath && pane.view) {
      pane.view.focus()
    } else {
      document.querySelector<HTMLElement>(`[data-pane-key="${pane.key}"]`)?.focus()
    }
  }

  /** ステータスバーやキーの範囲が読むモードを、今の領域のエディタに合わせ直す */
  private syncMode(): void {
    const view = this.view
    const mode = useModeStore.getState()
    if (view) {
      mode.setVim(vimModeOf(view))
      syncTreeState(view)
    } else {
      mode.setVim('NORMAL')
      mode.setDiagram(false)
      mode.setOnTreeBlock(false)
    }
  }

  /** 領域の状態を画面へ写す。サイドバーやステータスバーは、今の領域のメモを vault-store で読む */
  private emit(): void {
    usePaneStore.setState({
      panes: this.paneList.map((p) => ({ key: p.key, openPath: p.openPath, session: p.snapshot })),
      active: this.activeIdx,
    })
    const vault = useVaultStore.getState()
    if (vault.openPath !== this.active.openPath) {
      vault.setOpenPath(this.active.openPath)
    }
    if (vault.session !== this.active.snapshot) {
      vault.setSession(this.active.snapshot)
    }
  }

  /** 次に起動したときに同じ並びで開けるよう、左右のメモを覚える */
  private rememberLayout(): void {
    const root = useVaultStore.getState().vault?.root
    if (!root) {
      return
    }
    const [left, right] = this.paneList
    updatePersistedState((s) => {
      const splitNote = { ...s.splitNote }
      if (right) {
        splitNote[root] = right.openPath ?? ''
      } else {
        Reflect.deleteProperty(splitNote, root)
      }
      const lastNote = left?.openPath ? { ...s.lastNote, [root]: left.openPath } : s.lastNote
      return { ...s, lastNote, splitNote }
    })
  }

  /** 読み書きが入れ違わないよう、すべての領域で 1 本の列に並べる */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  private panesWith(path: string): Pane[] {
    return this.paneList.filter((p) => p.session?.path === path)
  }

  openVault(path: string): Promise<void> {
    return this.enqueue(async () => {
      for (const pane of this.paneList) {
        await this.closeCurrent(pane)
      }
      this.paneList = this.paneList.slice(0, 1)
      this.activeIdx = 0
      this.emit()
      this.cache.clear()
      const store = useVaultStore.getState()
      try {
        const info = await vaultOpen(path)
        store.setVault(info)
        store.setOpenError(null)
        updatePersistedState((s) => ({ ...s, lastVault: info.root }))
        await this.refreshNow()
        const exists = (p: string) => useVaultStore.getState().entries.some((e) => e.path === p)
        const last = persistedState().lastNote[info.root]
        // 左を開くと並びを覚え直すので、右のメモは先に読んでおく
        const split = persistedState().splitNote[info.root]
        if (last !== undefined && exists(last)) {
          await this.openNow(this.active, last)
        }
        if (split !== undefined) {
          const right = await this.addPane()
          if (exists(split)) {
            await this.openNow(right, split)
          }
          this.activeIdx = 0
          this.emit()
          this.syncMode()
          requestAnimationFrame(() => this.focusPane(0))
        }
      } catch (error) {
        console.error('保管庫を開けませんでした', error)
        store.setVault(null)
        store.setOpenError(message(error))
      }
    })
  }

  /** 右に領域を足し、そのエディタが出来るまで待つ */
  private async addPane(): Promise<Pane> {
    const pane = new Pane(this.nextKey++)
    this.paneList = [...this.paneList, pane]
    this.emit()
    await pane.ready
    return pane
  }

  /** 本文を左右に分ける（`<C-w>v` / `:vs`）。path があれば右でそのメモを開き、無ければ作る */
  split(path: string | null): Promise<void> {
    return this.enqueue(async () => {
      if (path) {
        const index = this.paneList.findIndex((p) => p.openPath === path)
        if (index !== -1) {
          // 同じメモを 2 つのエディタで開くと正本が 2 つになるので、開いている側へ移るだけにする
          this.focusPane(index)
          return
        }
      }
      if (this.paneList.length >= MAX_PANES) {
        useStatusStore.getState().show(`本文は ${MAX_PANES} つまでしか分けられません`)
        return
      }
      const pane = await this.addPane()
      this.rememberLayout()
      if (path) {
        const exists = useVaultStore.getState().entries.some((e) => e.path === path)
        if (exists || (await this.createNow(path))) {
          await this.openNow(pane, path)
        }
      } else {
        // 何も開いていない領域は描き直されるまでフォーカスを受けられない
        requestAnimationFrame(() => this.focusPane(this.paneList.indexOf(pane)))
      }
    })
  }

  /** 今の領域を閉じる（`<C-w>q` / `:q`）。最後の 1 つは閉じない */
  closePane(): Promise<void> {
    return this.enqueue(async () => {
      if (this.paneList.length <= 1) {
        useStatusStore.getState().show('最後の領域は閉じられません')
        return
      }
      const pane = this.active
      await this.closeCurrent(pane)
      const index = this.paneList.indexOf(pane)
      this.paneList = this.paneList.filter((p) => p !== pane)
      this.activeIdx = Math.max(0, index - 1)
      this.emit()
      this.syncMode()
      this.rememberLayout()
      requestAnimationFrame(() => this.focusPane())
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

  /** 今の領域で開く。もう一方の領域で開いていれば、そちらへ移る */
  openNote(path: string): Promise<void> {
    return this.enqueue(() => this.openNow(this.active, path))
  }

  /**
   * 開く前に読んでおく（サイドバーのカーソルが乗ったときなど）。開くときに IPC を待たずに済む。
   * iCloud からダウンロードが要るものは、選んだだけで落とさないよう読まない
   */
  prefetch(path: string): void {
    const entry = useVaultStore.getState().entries.find((e) => e.path === path)
    if (entry?.kind !== 'note' || entry.placeholder || this.panesWith(path).length > 0) {
      return
    }
    if (this.cache.has(path)) {
      return
    }
    const version = this.cache.version(path)
    noteRead(path).then(
      (note) => this.cache.set(path, note, version),
      () => undefined,
    )
  }

  private async openNow(pane: Pane, path: string): Promise<void> {
    const store = useVaultStore.getState()
    const handle = pane.handle
    if (!handle) {
      return
    }
    const elsewhere = this.paneList.findIndex((p) => p.openPath === path)
    if (elsewhere !== -1) {
      this.focusPane(elsewhere)
      return
    }
    const entry = store.entries.find((e) => e.path === path)
    if (entry?.placeholder) {
      useStatusStore.getState().show('iCloud からダウンロードしています…')
    }
    const cached = entry?.placeholder ? undefined : this.cache.get(path)
    let note: { content: string; hash: string }
    if (cached) {
      note = cached
    } else {
      // 読んでいる間に、前のメモを書いておく（書くのはエディタを差し替える前でないといけない）
      const flushing = pane.session?.flush()
      try {
        note = await noteRead(path)
      } catch (error) {
        console.error('メモを開けませんでした', error)
        useStatusStore.getState().show(`メモを開けませんでした: ${message(error)}`)
        return
      } finally {
        await flushing
      }
    }
    // 何も開いていない間はエディタの枠が invisible。切り替えのときは開いたままにして、
    // 途中で invisible に描き直されないようにする（隠れた要素には focus() が効かない）
    const wasOpen = pane.openPath !== null
    await this.closeCurrent(pane, { keepOpenPath: true })
    // 開いている間の正本はエディタ。閉じるときに入れ直す
    this.cache.delete(path)
    handle.load(note.content, displayName(path))
    const session = new NoteSession(
      path,
      note.hash,
      { read: noteRead, write: noteWrite },
      {
        getText: () => handle.view.state.doc.toString(),
        replaceText: (text) => this.replaceText(pane, text),
      },
      (snapshot) => {
        pane.snapshot = snapshot
        this.emit()
      },
    )
    pane.session = session
    pane.openPath = path
    pane.snapshot = initialSession
    this.emit()
    store.reveal(path)
    const vault = store.vault
    if (vault) {
      const saved = persistedState().notes[noteKey(vault.root, path)]
      if (saved) {
        restoreTreeFolds(handle.view, saved.treeFolds)
        restoreFolds(handle.view, saved.folds)
      }
      this.rememberLayout()
    }
    if (entry?.placeholder) {
      useStatusStore.getState().clear()
      void this.refreshNow()
    }
    if (wasOpen) {
      handle.view.focus()
    } else {
      // invisible の枠はまだ描き直されていない。描き直したあとに当てる
      requestAnimationFrame(() => handle.view.focus())
    }
    if (cached) {
      // 先読みした中身は古いかもしれない。読み直し、違えば外の変更として取り込む
      void this.enqueue(async () => {
        if (pane.session === session) {
          await session.onExternalChange()
        }
      })
    }
  }

  private replaceText(pane: Pane, text: string): void {
    const view = pane.view
    if (!view) {
      return
    }
    const change = minimalChange(view.state.doc.toString(), text)
    if (change) {
      view.dispatch({
        changes: change,
        annotations: [
          externalLoad.of(true),
          allowWhileReading.of(true),
          Transaction.addToHistory.of(false),
        ],
      })
    }
  }

  private rememberNoteState(pane: Pane): void {
    const vault = useVaultStore.getState().vault
    const view = pane.view
    if (!vault || !view || !pane.session) {
      return
    }
    setNoteState(noteKey(vault.root, pane.session.path), {
      folds: foldedLines(view.state),
      treeFolds: treeFolds(view.state),
    })
  }

  private async closeCurrent(pane: Pane, { keepOpenPath = false } = {}): Promise<void> {
    const session = pane.session
    if (!session) {
      return
    }
    this.rememberNoteState(pane)
    await session.flush()
    const view = pane.view
    if (view && !session.dirty && session.state.saveState === 'saved') {
      this.cache.set(session.path, { content: view.state.doc.toString(), hash: session.hash })
    }
    session.dispose()
    pane.session = null
    pane.snapshot = initialSession
    if (!keepOpenPath) {
      pane.openPath = null
    }
    this.emit()
  }

  /** `:w`、ウィンドウのフォーカスが外れたとき。すべての領域を書く */
  async flush(): Promise<void> {
    await Promise.all(
      this.paneList.map((pane) => {
        this.rememberNoteState(pane)
        return pane.session?.flush() ?? Promise.resolve()
      }),
    )
  }

  keepMine(key = this.active.key): Promise<void> {
    return this.pane(key)?.session?.keepMine() ?? Promise.resolve()
  }

  takeTheirs(key = this.active.key): void {
    this.pane(key)?.session?.takeTheirs()
  }

  onVaultChanged(paths: readonly string[]): Promise<void> {
    return this.enqueue(async () => {
      for (const path of paths) {
        this.cache.delete(path)
      }
      await this.refreshNow()
      for (const pane of this.paneList) {
        if (pane.session && paths.includes(pane.session.path)) {
          await pane.session.onExternalChange()
        }
      }
    })
  }

  createNote(path: string): Promise<void> {
    return this.enqueue(async () => {
      if (await this.createNow(path)) {
        await this.openNow(this.active, path)
      }
    })
  }

  /** 作れたか、もうあれば true */
  private async createNow(path: string): Promise<boolean> {
    this.cache.delete(path)
    try {
      await noteCreate(path)
    } catch (error) {
      if (!(error instanceof VaultCommandError && error.kind === 'alreadyExists')) {
        console.error('メモを作れませんでした', error)
        useStatusStore.getState().show(`メモを作れませんでした: ${message(error)}`)
        return false
      }
    }
    await this.refreshNow()
    return true
  }

  renameNote(from: string, to: string): Promise<void> {
    return this.enqueue(async () => {
      if (from === to) {
        return
      }
      this.cache.delete(from)
      this.cache.delete(to)
      const opened = this.panesWith(from)
      for (const pane of opened) {
        await this.closeCurrent(pane)
      }
      try {
        await noteRename(from, to)
      } catch (error) {
        console.error('名前を変えられませんでした', error)
        useStatusStore.getState().show(`名前を変えられませんでした: ${message(error)}`)
        await this.refreshNow()
        for (const pane of opened) {
          await this.openNow(pane, from)
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
      if (useVaultStore.getState().yanked === from) {
        useVaultStore.getState().setYanked(to)
      }
      await this.refreshNow()
      for (const pane of opened) {
        await this.openNow(pane, to)
      }
      if (opened.length === 0 && useVaultStore.getState().cursor === from) {
        useVaultStore.getState().reveal(to)
      }
    })
  }

  /** 複製したメモは開かず、サイドバーのカーソルだけを移す */
  duplicateNote(from: string, dir: string): Promise<void> {
    return this.enqueue(async () => {
      for (const pane of this.panesWith(from)) {
        await pane.session?.flush()
      }
      let path: string
      try {
        path = await noteDuplicate(from, dir)
      } catch (error) {
        console.error('複製できませんでした', error)
        useStatusStore.getState().show(`複製できませんでした: ${message(error)}`)
        return
      }
      await this.refreshNow()
      useVaultStore.getState().reveal(path)
      useStatusStore.getState().show(`「${displayName(path)}」を作りました`)
    })
  }

  trashNote(path: string): Promise<void> {
    return this.enqueue(async () => {
      this.cache.delete(path)
      for (const pane of this.panesWith(path)) {
        await this.closeCurrent(pane)
        pane.handle?.load('', null)
      }
      this.rememberLayout()
      const store = useVaultStore.getState()
      const rows = visibleRows(store.entries, store.expanded)
      const index = rows.findIndex((row) => row.path === path)
      // 消した行にカーソルが残ると j / k が一覧の先頭からやり直しになるので、隣の行へ移す
      const neighbor = rows[index + 1]?.path ?? rows[index - 1]?.path ?? null
      try {
        await noteTrash(path)
        if (useVaultStore.getState().cursor === path) {
          useVaultStore.getState().setCursor(neighbor)
        }
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
