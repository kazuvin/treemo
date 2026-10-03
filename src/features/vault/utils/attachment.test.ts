import { describe, expect, it } from 'vitest'
import {
  attachmentDir,
  imageExtension,
  imageMarkdown,
  pastedImageName,
  resolveImagePath,
  sanitizeFolder,
} from './attachment'

describe('attachmentDir', () => {
  it('Obsidian の 4 つの置き場所に従う', () => {
    expect(attachmentDir('a/b/memo.md', 'root', 'img')).toBe('')
    expect(attachmentDir('a/b/memo.md', 'folder', 'img')).toBe('img')
    expect(attachmentDir('a/b/memo.md', 'same', 'img')).toBe('a/b')
    expect(attachmentDir('a/b/memo.md', 'subfolder', 'img')).toBe('a/b/img')
    expect(attachmentDir('memo.md', 'same', 'img')).toBe('')
    expect(attachmentDir('memo.md', 'subfolder', 'img')).toBe('img')
  })

  it('フォルダ名から保管庫の外や隠しフォルダを指す要素を落とす', () => {
    expect(sanitizeFolder('/../x/./.git/y/')).toBe('x/y')
    expect(attachmentDir('memo.md', 'folder', '..')).toBe('')
  })
})

describe('pastedImageName', () => {
  it('貼り付けた時刻で名前を付ける', () => {
    expect(pastedImageName(new Date(2026, 9, 3, 9, 5, 7), 'png')).toBe(
      'Pasted image 20261003090507.png',
    )
  })
})

describe('imageExtension', () => {
  it('置ける画像だけ拡張子を返す', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg')
    expect(imageExtension('application/pdf')).toBeNull()
  })
})

describe('imageMarkdown と resolveImagePath', () => {
  it('メモから見た相対パスで書き、読み戻せる', () => {
    const cases: [string, string, string][] = [
      ['memo.md', 'Pasted image 1.png', '![](Pasted%20image%201.png)'],
      ['a/b/memo.md', 'a/b/img/x.png', '![](img/x.png)'],
      ['a/b/memo.md', 'x.png', '![](../../x.png)'],
      ['a/b/memo.md', 'a/c/x (1)#?.png', '![](../c/x%20%281%29%23%3F.png)'],
    ]
    for (const [note, image, markdown] of cases) {
      expect(imageMarkdown(note, image)).toBe(markdown)
      const link = /^!\[\]\((.*)\)$/.exec(markdown)?.[1] ?? ''
      expect(resolveImagePath(note, link)).toBe(image)
    }
  })

  it('外の URL と保管庫の外を指すものは読まない', () => {
    expect(resolveImagePath('memo.md', 'https://example.com/a.png')).toBeNull()
    expect(resolveImagePath('memo.md', 'data:image/png;base64,AAAA')).toBeNull()
    expect(resolveImagePath('a/memo.md', '../../x.png')).toBeNull()
  })

  it('山括弧、保管庫の直下から数える / 、手で書いた空白を読む', () => {
    expect(resolveImagePath('a/memo.md', '<my image.png>')).toBe('a/my image.png')
    expect(resolveImagePath('a/memo.md', '/img/x.png')).toBe('img/x.png')
    expect(resolveImagePath('a/memo.md', './x.png?v=1')).toBe('a/x.png')
  })
})
