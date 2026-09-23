import { invoke } from '@tauri-apps/api/core'
import { z } from 'zod'
import { DEFAULT_THEME, THEME_IDS } from '@/lib/theme'

/**
 * アプリの状態。保管庫の外（Application Support）に置く（docs/vault.md の「方針」）。
 * メモごとの状態の鍵は「保管庫のパス + NUL + メモのパス」。
 */
const noteStateSchema = z.object({
  folds: z.array(z.number()).default([]),
  treeFolds: z.record(z.string(), z.array(z.string())).default({}),
})

const schema = z.object({
  lastVault: z.string().nullable().default(null),
  lastNote: z.record(z.string(), z.string()).default({}),
  sidebarVisible: z.boolean().default(true),
  sidebarSide: z.enum(['left', 'right']).catch('left'),
  preferFullscreen: z.boolean().default(false),
  showKeyGuide: z.boolean().default(true),
  // 消したテーマが残っていても、状態の全体を捨てずに既定へ戻す
  theme: z.enum(THEME_IDS).catch(DEFAULT_THEME),
  notes: z.record(z.string(), noteStateSchema).default({}),
})

export type PersistedState = z.infer<typeof schema>
export type NoteState = z.infer<typeof noteStateSchema>

/** 覚えておくメモの数。古いものから捨てる */
const MAX_NOTES = 500
const SAVE_DELAY_MS = 1000

let state: PersistedState = schema.parse({})
let timer: ReturnType<typeof setTimeout> | null = null

export async function loadPersistedState(): Promise<PersistedState> {
  try {
    const json = await invoke<string | null>('app_state_read')
    if (json) {
      const parsed = schema.safeParse(JSON.parse(json))
      if (parsed.success) {
        state = parsed.data
      } else {
        console.error('アプリの状態を読めませんでした。初めの状態から始めます', parsed.error)
      }
    }
  } catch (error) {
    console.error('アプリの状態を読めませんでした', error)
  }
  return state
}

export function persistedState(): PersistedState {
  return state
}

async function write(): Promise<void> {
  try {
    await invoke('app_state_write', { json: JSON.stringify(state) })
  } catch (error) {
    console.error('アプリの状態を保存できませんでした', error)
  }
}

export function updatePersistedState(patch: (s: PersistedState) => PersistedState): void {
  state = patch(state)
  if (timer !== null) {
    clearTimeout(timer)
  }
  timer = setTimeout(() => {
    timer = null
    void write()
  }, SAVE_DELAY_MS)
}

export function noteKey(vaultRoot: string, path: string): string {
  return `${vaultRoot}\u0000${path}`
}

export function setNoteState(key: string, note: NoteState): void {
  updatePersistedState((s) => {
    const notes = { ...s.notes }
    Reflect.deleteProperty(notes, key)
    notes[key] = note
    const keys = Object.keys(notes)
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_NOTES))) {
      Reflect.deleteProperty(notes, old)
    }
    return { ...s, notes }
  })
}
