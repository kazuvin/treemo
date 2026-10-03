import { attachmentWrite, vaultFileUrl } from '@/features/vault/api/vault'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import {
  attachmentDir,
  imageExtension,
  imageMarkdown,
  pastedImageName,
  resolveImagePath,
} from '@/features/vault/utils/attachment'
import { now } from '@/lib/date'
import { useStatusStore } from '@/stores/status-store'
import { useUiStore } from './ui-store'

/** メモ（notePath）の中の画像のリンクを、`<img>` で読める URL にする */
export function resolveImageUrl(notePath: string | null, src: string): string | null {
  const link = src.trim()
  if (/^(https?|data):/i.test(link)) {
    return link
  }
  const root = useVaultStore.getState().vault?.root
  const rel = notePath === null ? null : resolveImagePath(notePath, link)
  return root && rel ? vaultFileUrl(root, rel) : null
}

/**
 * 貼り付けた画像を設定の場所に置き、メモに書く Markdown を返す。
 * 置くあいだに領域で別のメモを開いたら、リンクは書かない（画像は置いたまま残る）
 */
export async function pasteImages(
  pane: { readonly openPath: string | null },
  files: readonly File[],
): Promise<string | null> {
  const notePath = pane.openPath
  if (notePath === null) {
    return null
  }
  const { attachmentLocation, attachmentFolder } = useUiStore.getState()
  const dir = attachmentDir(notePath, attachmentLocation, attachmentFolder)
  const links: string[] = []
  const pastedAt = now()
  for (const file of files) {
    const ext = imageExtension(file.type)
    if (!ext) {
      useStatusStore.getState().show(`貼り付けられない形式の画像です: ${file.type}`)
      continue
    }
    const name = pastedImageName(pastedAt, ext)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const written = await attachmentWrite(dir ? `${dir}/${name}` : name, bytes)
      links.push(imageMarkdown(notePath, written))
    } catch (error) {
      console.error('画像を置けませんでした', error)
      useStatusStore
        .getState()
        .show(`画像を置けませんでした: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (links.length === 0 || pane.openPath !== notePath) {
    return null
  }
  return links.join('\n')
}
