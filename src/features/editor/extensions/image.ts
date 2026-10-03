import { type Extension, Facet } from '@codemirror/state'
import { EditorView, WidgetType } from '@codemirror/view'
import { isReading } from '@/lib/reading'

/** メモの中の画像のリンクを、`<img>` に渡せる URL にするもの。読めなければ null */
type ImageResolver = (src: string, view: EditorView) => string | null

/**
 * 貼り付けた画像を保管庫に置き、メモに書く Markdown を返すもの。置けないときや、置くあいだに
 * 別のメモへ移ったときは null
 */
type ImagePasteHandler = (files: readonly File[], view: EditorView) => Promise<string | null>

/** app が保管庫を見て URL にする関数を渡す。無ければリンクをそのまま使う */
export const imageResolver = Facet.define<ImageResolver, ImageResolver | null>({
  combine: (values) => values[0] ?? null,
})

/** app が画像を書く関数を渡す。無ければ画像の貼り付けを受けない */
export const imagePasteHandler = Facet.define<ImagePasteHandler, ImagePasteHandler | null>({
  combine: (values) => values[0] ?? null,
})

class ImageWidget extends WidgetType {
  constructor(
    readonly url: string | null,
    readonly src: string,
    readonly alt: string,
  ) {
    super()
  }

  override eq(other: ImageWidget): boolean {
    return other.url === this.url && other.src === this.src && other.alt === this.alt
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-lp-image'
    const missing = () => {
      wrap.replaceChildren()
      wrap.classList.add('cm-lp-image-missing')
      wrap.textContent = `画像を読めません: ${this.src}`
    }
    if (this.url === null) {
      missing()
      return wrap
    }
    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.alt
    img.draggable = false
    // 読み込みで行の高さが変わるので、CodeMirror に測り直させる
    img.addEventListener('load', () => view.requestMeasure())
    img.addEventListener('error', () => {
      missing()
      view.requestMeasure()
    })
    wrap.append(img)
    return wrap
  }
}

/** ライブプレビューが `![alt](src)` を置き換える絵 */
export function imageWidget(view: EditorView, src: string, alt: string): ImageWidget {
  const resolve = view.state.facet(imageResolver)
  return new ImageWidget(resolve ? resolve(src, view) : src, src, alt)
}

/**
 * クリップボードに画像があれば保管庫に置き、リンクをカーソルの位置に書く。
 * 表計算ソフトのセルのように、文字と一緒に絵も載せてくるものは文字を貼る
 */
const pasteImages = EditorView.domEventHandlers({
  paste(event, view) {
    const handler = view.state.facet(imagePasteHandler)
    const data = event.clipboardData
    if (!handler || !data || isReading(view.state)) {
      return false
    }
    const files = [...data.files].filter((file) => file.type.startsWith('image/'))
    if (files.length === 0 || (data.types.includes('text/html') && data.getData('text/plain'))) {
      return false
    }
    event.preventDefault()
    void handler(files, view).then((markdown) => {
      if (markdown === null) {
        return
      }
      const at = view.state.selection.main.head
      view.dispatch({
        changes: { from: at, insert: markdown },
        selection: { anchor: at + markdown.length },
        scrollIntoView: true,
        userEvent: 'input.paste',
      })
    })
    return true
  },
})

const theme = EditorView.theme({
  '.cm-lp-image': { display: 'block', padding: 'var(--spacing-gap) 0' },
  '.cm-lp-image img': {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '480px',
    borderRadius: '4px',
  },
  '.cm-lp-image-missing': {
    color: 'var(--color-muted-foreground)',
    fontSize: 'var(--text-xs)',
  },
})

/** 画像を描くのはライブプレビュー。これは貼り付けと見た目だけ */
export function images(): Extension {
  return [pasteImages, theme]
}
