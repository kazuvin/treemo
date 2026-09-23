import { invoke } from '@tauri-apps/api/core'

/** キーの割り当ての上書き（Application Support の keybindings.json）。無ければ null */
export function readKeybindings(): Promise<string | null> {
  return invoke<string | null>('keybindings_read')
}

/** keybindings.json を既定のテキストエディタで開く。無ければ空の形で作る */
export async function openKeybindings(): Promise<void> {
  await invoke('keybindings_open')
}

export async function writeKeybindings(json: string): Promise<void> {
  await invoke('keybindings_write', { json })
}
