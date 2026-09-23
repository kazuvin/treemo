import type { Command, KeyScope } from '@/lib/command'

/** コマンドに今割り当ててある最初のキー。割り当てを変えても案内が追いつくよう、表示はここから引く */
export function keyLabel(
  commands: readonly Command[],
  id: string,
  scope?: KeyScope,
): string | null {
  const command = commands.find((c) => c.id === id)
  return command?.keys?.find((k) => !scope || k.scope === scope)?.sequence ?? null
}
