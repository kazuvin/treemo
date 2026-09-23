import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { z } from 'zod'

const errorSchema = z.object({
  kind: z.string(),
  message: z.string(),
  currentHash: z.string().optional(),
})

export class VaultCommandError extends Error {
  readonly kind: string
  readonly currentHash: string | undefined

  constructor(kind: string, message: string, currentHash?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'VaultCommandError'
    this.kind = kind
    this.currentHash = currentHash
  }
}

async function call<T>(command: string, args: Record<string, unknown>, schema: z.ZodType<T>) {
  let raw: unknown
  try {
    raw = await invoke(command, args)
  } catch (error) {
    const parsed = errorSchema.safeParse(error)
    if (parsed.success) {
      throw new VaultCommandError(parsed.data.kind, parsed.data.message, parsed.data.currentHash, {
        cause: error,
      })
    }
    throw new VaultCommandError('unknown', String(error), undefined, { cause: error })
  }
  return schema.parse(raw)
}

const vaultInfoSchema = z.object({ root: z.string(), name: z.string() })
export type VaultInfo = z.infer<typeof vaultInfoSchema>

const entrySchema = z.object({
  path: z.string(),
  kind: z.enum(['dir', 'note']),
  placeholder: z.boolean(),
  conflict: z.boolean(),
})
export type VaultEntry = z.infer<typeof entrySchema>

const noteSchema = z.object({ content: z.string(), hash: z.string() })
export type NoteContent = z.infer<typeof noteSchema>

export function vaultOpen(path: string): Promise<VaultInfo> {
  return call('vault_open', { path }, vaultInfoSchema)
}

export function vaultList(): Promise<VaultEntry[]> {
  return call('vault_list', {}, z.array(entrySchema))
}

const frontMatterSchema = z.object({ path: z.string(), text: z.string() })
export type FrontMatterEntry = z.infer<typeof frontMatterSchema>

/** フロントマターのあるメモの、フロントマター（`---` の間）だけ */
export function vaultFrontMatters(): Promise<FrontMatterEntry[]> {
  return call('vault_front_matters', {}, z.array(frontMatterSchema))
}

export function vaultDefaultDir(): Promise<string | null> {
  return call('vault_default_dir', {}, z.string().nullable())
}

export function noteRead(rel: string): Promise<NoteContent> {
  return call('note_read', { rel }, noteSchema)
}

export function noteWrite(rel: string, content: string, baseHash: string | null): Promise<string> {
  return call('note_write', { rel, content, baseHash }, z.string())
}

export function noteCreate(rel: string): Promise<string> {
  return call('note_create', { rel }, z.string())
}

export function noteRename(from: string, to: string): Promise<void> {
  return call('note_rename', { from, to }, z.null()).then(() => undefined)
}

export function noteTrash(rel: string): Promise<void> {
  return call('note_trash', { rel }, z.null()).then(() => undefined)
}

const changedSchema = z.object({ paths: z.array(z.string()) })

/** 保管庫の中が外部で変わったとき（vault://changed）。戻り値で購読をやめる */
export function onVaultChanged(handler: (paths: string[]) => void): Promise<() => void> {
  return listen('vault://changed', (event) => {
    const parsed = changedSchema.safeParse(event.payload)
    if (parsed.success) {
      handler(parsed.data.paths)
    } else {
      console.error('vault://changed の形が違います', parsed.error)
    }
  })
}
