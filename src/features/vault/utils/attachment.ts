import { compactTimestamp } from '@/lib/date'

/**
 * 貼り付けた画像の置き場所と、メモに書くリンク。Obsidian の「新しい添付ファイルの場所」に倣う
 * （docs/vault.md の「画像」）
 */
export const ATTACHMENT_LOCATIONS = ['root', 'folder', 'same', 'subfolder'] as const
export type AttachmentLocation = (typeof ATTACHMENT_LOCATIONS)[number]
export const DEFAULT_ATTACHMENT_LOCATION: AttachmentLocation = 'root'
export const DEFAULT_ATTACHMENT_FOLDER = 'attachments'

export function attachmentLocationLabel(location: AttachmentLocation): string {
  switch (location) {
    case 'root':
      return '保管庫の直下'
    case 'folder':
      return '指定したフォルダ'
    case 'same':
      return 'メモと同じフォルダ'
    case 'subfolder':
      return 'メモのフォルダの下のサブフォルダ'
  }
}

/** Rust の `IMAGE_EXTS`（src-tauri/src/vault/fs.rs）と同じにする */
const IMAGE_EXTS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
}

/** 置ける画像の拡張子。置けない形式なら null */
export function imageExtension(mime: string): string | null {
  return IMAGE_EXTS[mime] ?? null
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

function join(...parts: string[]): string {
  return parts.filter((p) => p !== '').join('/')
}

/** 前後の `/` を落とし、`.` と `..` と空の要素を除いたフォルダ名。保管庫の外を指せないようにする */
export function sanitizeFolder(folder: string): string {
  return folder
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !part.startsWith('.'))
    .join('/')
}

/** 画像を置くフォルダ（保管庫からの相対パス。直下なら空文字） */
export function attachmentDir(
  notePath: string,
  location: AttachmentLocation,
  folder: string,
): string {
  const name = sanitizeFolder(folder)
  switch (location) {
    case 'root':
      return ''
    case 'folder':
      return name
    case 'same':
      return dirOf(notePath)
    case 'subfolder':
      return join(dirOf(notePath), name)
  }
}

/** Obsidian と同じ `Pasted image 20261003123456.png` */
export function pastedImageName(date: Date, ext: string): string {
  return `Pasted image ${compactTimestamp(date)}.${ext}`
}

/** `from`（メモ）から見た `to` の相対パス */
function relativePath(from: string, to: string): string {
  const base = dirOf(from).split('/').filter(Boolean)
  const target = to.split('/')
  let common = 0
  while (common < base.length && common < target.length - 1 && base[common] === target[common]) {
    common++
  }
  return [...base.slice(common).map(() => '..'), ...target.slice(common)].join('/')
}

/** メモに書く画像のリンク。Obsidian と同じく、空白などは `%20` の形にする */
export function imageMarkdown(notePath: string, imagePath: string): string {
  const link = relativePath(notePath, imagePath)
    .split('/')
    // 括弧が対にならないと Markdown のリンクが切れる
    .map((part) =>
      encodeURIComponent(part).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`),
    )
    .join('/')
  return `![](${link})`
}

/**
 * メモの中の画像のリンクを、保管庫からの相対パスにする。外の URL や保管庫の外を指すものは null。
 * `/` で始まるものは保管庫の直下から数える
 */
export function resolveImagePath(notePath: string, src: string): string | null {
  let link = src.trim()
  if (link.startsWith('<') && link.endsWith('>')) {
    link = link.slice(1, -1)
  }
  if (link === '' || /^[a-z][a-z\d+.-]*:/i.test(link)) {
    return null
  }
  const decode = (part: string) => {
    try {
      return decodeURIComponent(part)
    } catch {
      // %XX として読めないものは、書いてあるとおりの名前として扱う
      return part
    }
  }
  const parts = link.startsWith('/') ? [] : dirOf(notePath).split('/').filter(Boolean)
  for (const part of (link.split(/[?#]/, 1)[0] ?? '').split('/').map(decode)) {
    if (part === '' || part === '.') {
      continue
    }
    if (part === '..') {
      if (parts.length === 0) {
        return null
      }
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.length === 0 ? null : parts.join('/')
}
