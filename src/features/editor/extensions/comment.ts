import { type EditorState, type Extension, type Range, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { isReading, readingChanged } from '@/lib/reading'
import { type CommentRange, commentAt, findComments } from '../utils/comment'

interface CommentState {
  ranges: CommentRange[]
  decorations: DecorationSet
}

const mark = Decoration.mark({ class: 'cm-comment' })
const hide = Decoration.replace({})

function build(state: EditorState, ranges: CommentRange[]): DecorationSet {
  const reading = isReading(state)
  const { doc } = state
  const decorations: Range<Decoration>[] = []
  for (const range of ranges) {
    if (!reading) {
      decorations.push(mark.range(range.from, range.to))
      continue
    }
    // 行をまるごと占めるコメントは、空の行を残さないよう後ろの改行も隠す
    const whole = doc.lineAt(range.from).from === range.from && doc.lineAt(range.to).to === range.to
    const to = whole && range.to < doc.length ? range.to + 1 : range.to
    decorations.push(hide.range(range.from, to))
  }
  return Decoration.set(decorations)
}

function compute(state: EditorState): CommentState {
  const ranges = findComments(state.doc.toString())
  return { ranges, decorations: build(state, ranges) }
}

/** 文書の中のコメントの位置。閲覧モードでは隠し、編集中は薄く見せる（Obsidian と同じ） */
export const commentField = StateField.define<CommentState>({
  create: compute,
  update: (value, tr) => {
    if (tr.docChanged) {
      return compute(tr.state)
    }
    if (readingChanged(tr)) {
      return { ranges: value.ranges, decorations: build(tr.state, value.ranges) }
    }
    return value
  },
  // 行をまたいで隠すので、ViewPlugin ではなく StateField から渡す
  provide: (field) => EditorView.decorations.from(field, (v) => v.decorations),
})

/** from から to までがまるごと 1 つのコメントの中か。ライブプレビューはコメントの中の記法を装飾しない */
export function inComment(state: EditorState, from: number, to: number): boolean {
  const comments = state.field(commentField, false)
  const around = comments ? commentAt(comments.ranges, from) : null
  return around !== null && to <= around.to
}

const theme = EditorView.theme({
  '.cm-comment': { color: 'var(--color-muted-foreground)' },
})

/** Obsidian のコメント（`%%…%%`）。記法は utils/comment.ts */
export function commentSyntax(): Extension {
  return [commentField, theme]
}
