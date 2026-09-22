import { create } from 'zustand'
import type { VaultEntry, VaultInfo } from '../api/vault'
import { expandAncestors, visibleRows } from '../utils/file-tree'
import type { SessionSnapshot } from '../utils/note-session'

interface VaultState {
  vault: VaultInfo | null
  entries: VaultEntry[]
  /** 開いているフォルダ */
  expanded: ReadonlySet<string>
  /** サイドバーで選んでいる行 */
  cursor: string | null
  openPath: string | null
  session: SessionSnapshot
  /** 保管庫を開けなかった理由。選び直す画面に出す */
  openError: string | null
  switcherOpen: boolean
  setVault: (vault: VaultInfo | null) => void
  setEntries: (entries: VaultEntry[]) => void
  setOpenPath: (openPath: string | null) => void
  setSession: (session: SessionSnapshot) => void
  setOpenError: (openError: string | null) => void
  setSwitcherOpen: (switcherOpen: boolean) => void
  toggleDir: (path: string, open?: boolean) => void
  setCursor: (cursor: string | null) => void
  moveCursor: (delta: number) => void
  reveal: (path: string) => void
}

export const initialSession: SessionSnapshot = { saveState: 'saved', theirs: null, error: null }

export const useVaultStore = create<VaultState>()((set, get) => ({
  vault: null,
  entries: [],
  expanded: new Set(),
  cursor: null,
  openPath: null,
  session: initialSession,
  openError: null,
  switcherOpen: false,
  setVault: (vault) =>
    set({ vault, entries: [], expanded: new Set(), cursor: null, openPath: null }),
  setEntries: (entries) => set({ entries }),
  setOpenPath: (openPath) => set({ openPath }),
  setSession: (session) => set({ session }),
  setOpenError: (openError) => set({ openError }),
  setSwitcherOpen: (switcherOpen) => set({ switcherOpen }),
  toggleDir: (path, open) => {
    const expanded = new Set(get().expanded)
    const next = open ?? !expanded.has(path)
    if (next) {
      expanded.add(path)
    } else {
      expanded.delete(path)
    }
    set({ expanded })
  },
  setCursor: (cursor) => set({ cursor }),
  moveCursor: (delta) => {
    const rows = visibleRows(get().entries, get().expanded)
    if (rows.length === 0) {
      return
    }
    const index = rows.findIndex((row) => row.path === get().cursor)
    const next = index === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, index + delta))
    set({ cursor: rows[next]?.path ?? null })
  },
  reveal: (path) => set({ expanded: expandAncestors(get().expanded, path), cursor: path }),
}))
