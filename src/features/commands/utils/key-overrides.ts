import { z } from 'zod'
import { type Command, KEY_SCOPES, type KeyBinding } from '@/lib/command'

/**
 * keybindings.json の形。コマンドの ID ごとに、割り当てを丸ごと置き換える。
 * 空の配列はキーを外す。書き方は docs/keybindings.md の「割り当てを変える」。
 */
const schema = z.record(
  z.string(),
  z.array(z.object({ scope: z.enum(KEY_SCOPES), sequence: z.string().min(1) }).strict()),
)

export type KeyOverrides = Record<string, KeyBinding[]>

export type ParsedOverrides = { ok: true; overrides: KeyOverrides } | { ok: false; error: string }

/**
 * TREE モードを DIAGRAM モードと呼び替える前に書かれた keybindings.json を、今の ID と範囲に
 * 読み替える。利用者が手で書いたファイルなので、古い書き方でも割り当てを失わないようにする
 */
function migrateLegacy(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return raw
  }
  return Object.fromEntries(
    Object.entries(raw).map(([id, keys]) => [
      id.startsWith('tree.') ? `diagram.${id.slice('tree.'.length)}` : id,
      Array.isArray(keys)
        ? keys.map((key: unknown) =>
            typeof key === 'object' && key !== null && 'scope' in key && key.scope === 'tree'
              ? { ...key, scope: 'diagram' }
              : key,
          )
        : keys,
    ]),
  )
}

export function parseKeyOverrides(json: string): ParsedOverrides {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const parsed = schema.safeParse(migrateLegacy(raw))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.join('.') ?? ''
    return { ok: false, error: where ? `${where}: ${issue?.message}` : String(issue?.message) }
  }
  return { ok: true, overrides: parsed.data }
}

export function applyKeyOverrides(
  commands: readonly Command[],
  overrides: KeyOverrides,
): { commands: Command[]; unknown: string[] } {
  const ids = new Set(commands.map((c) => c.id))
  return {
    commands: commands.map((command) => {
      const keys = overrides[command.id]
      return keys ? { ...command, keys } : command
    }),
    unknown: Object.keys(overrides).filter((id) => !ids.has(id)),
  }
}

function sameKeys(a: readonly KeyBinding[], b: readonly KeyBinding[]): boolean {
  return (
    a.length === b.length &&
    a.every((key, i) => key.scope === b[i]?.scope && key.sequence === b[i]?.sequence)
  )
}

/**
 * 設定画面で編集した割り当てのうち、既定と違うものだけを上書きとして残す。
 * 既定に戻したコマンドは keybindings.json から消える。
 */
export function diffKeyOverrides(defaults: readonly Command[], edited: KeyOverrides): KeyOverrides {
  const out: KeyOverrides = {}
  for (const command of defaults) {
    const keys = edited[command.id]
    if (keys && !sameKeys(keys, command.keys ?? [])) {
      out[command.id] = keys
    }
  }
  return out
}
