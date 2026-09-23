import { EditorState, type Extension, type Range, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import { isReading, readingChanged } from '@/lib/reading'
import { useModeStore } from '@/stores/mode-store'
import { useDiagramStore } from '../stores/diagram-store'
import { collapsedIds } from '../utils/ops'
import { enterTreeSpec } from './tree-actions'
import {
  activeBlock,
  blockAtCursor,
  blocksField,
  hitPathAtCursor,
  keepCursorInBlock,
  rootsOf,
  searchHighlightField,
  treeUiField,
} from './tree-state'
import { TreeWidget } from './tree-widget'

function buildDecorations(state: EditorState): DecorationSet {
  const ui = state.field(treeUiField)
  const onBlock = blockAtCursor(state)
  const hitId = hitPathAtCursor(state)?.join('.') ?? null
  const search = state.field(searchHighlightField)
  const ranges: Range<Decoration>[] = []
  for (const block of state.field(blocksField)) {
    // 閲覧モードではソース表示にしていたブロックも絵で見せる
    if (block.from === ui.source && !isReading(state)) {
      continue
    }
    const active = ui.active?.from === block.from ? ui.active : null
    let status: 'idle' | 'selected' | 'diagram' | 'fullscreen' = 'idle'
    if (active) {
      status = active.fullscreen ? 'fullscreen' : 'diagram'
    } else if (onBlock?.from === block.from) {
      status = 'selected'
    }
    const roots = rootsOf(block, ui)
    const widget = new TreeWidget({
      from: block.from,
      source: block.source,
      status,
      roots,
      strayLines: block.block.strayLines,
      selectedId: active?.path?.join('.') ?? null,
      hitId: status === 'selected' ? hitId : null,
      search,
      editing: active?.editing ?? null,
      foldKey: collapsedIds(roots).join(','),
    })
    ranges.push(Decoration.replace({ widget, block: true }).range(block.from, block.to))
  }
  return Decoration.set(ranges)
}

const decorationsField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (value, tr) => {
    if (
      tr.docChanged ||
      tr.selection ||
      readingChanged(tr) ||
      tr.startState.field(treeUiField) !== tr.state.field(treeUiField) ||
      tr.startState.field(searchHighlightField) !== tr.state.field(searchHighlightField)
    ) {
      return buildDecorations(tr.state)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** エディタの外（ステータスバー、全画面、キーの割り当て）に状態を流す */
function publish(state: EditorState): void {
  const ui = state.field(treeUiField)
  const mode = useModeStore.getState()
  const onBlock = blockAtCursor(state) !== null
  if (mode.diagram !== (ui.active !== null)) {
    mode.setDiagram(ui.active !== null)
  }
  if (mode.onTreeBlock !== onBlock) {
    mode.setOnTreeBlock(onBlock)
  }
  const block = activeBlock(state)
  const tree = useDiagramStore.getState()
  if (ui.active && block) {
    tree.setActive({
      from: block.from,
      roots: rootsOf(block, ui),
      strayLines: block.block.strayLines,
      path: ui.active.path,
      editing: ui.active.editing,
      fullscreen: ui.active.fullscreen,
    })
  } else if (tree.active) {
    tree.setActive(null)
  }
}

const publisher = ViewPlugin.define((view) => {
  publish(view.state)
  return {
    update: (update) => {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some(readingChanged) ||
        update.startState.field(treeUiField) !== update.state.field(treeUiField)
      ) {
        publish(update.state)
      }
    },
    destroy: () => {
      useModeStore.getState().setDiagram(false)
      useModeStore.getState().setOnTreeBlock(false)
      useDiagramStore.getState().setActive(null)
    },
  }
})

/**
 * Vim の検索などでカーソルがノードの行に置かれたら、そのノードを選んで DIAGRAM (NORMAL) に入る
 * （docs/tree-block.md の「検索」）。読めない行があるブロックでは入れないので、当たりを示すだけにする
 */
const enterOnHit = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.docChanged || tr.annotation(keepCursorInBlock)) {
    return tr
  }
  const state = tr.state
  if (!state.selection.main.empty) {
    return tr
  }
  const block = blockAtCursor(state)
  const path = hitPathAtCursor(state)
  if (!block || !path || block.block.strayLines.length > 0) {
    return tr
  }
  return [tr, { ...enterTreeSpec(state, block, path), sequential: true }]
})

/** ブロックの絵が占める範囲は、カーソルの移動では 1 つのまとまりとして飛ばす */
const atomic = EditorView.atomicRanges.of((view) => view.state.field(decorationsField))

/**
 * ブロックの上では本文のカーソルがブロックの端に残って見えるので隠す（選択状態は枠で示す）。
 * あわせて絵の幅を本文にそろえる
 */
const blockTheme = [
  EditorView.editorAttributes.of((view) =>
    blockAtCursor(view.state) ? { class: 'cm-on-tree-block' } : null,
  ),
  EditorView.theme({
    '&.cm-on-tree-block .cm-fat-cursor, &.cm-on-tree-block .cm-cursor': {
      visibility: 'hidden',
    },
    // 本文の行は左右に余白を持つ（.cm-line）。絵の幅を本文の幅にそろえる
    '.cm-tree-block': { padding: '0 var(--spacing-edge-h)' },
  }),
]

/** エディタにツリーブロックを載せる拡張。app が features/editor に渡す */
export function treeExtension(): Extension {
  return [
    blocksField,
    treeUiField,
    searchHighlightField,
    decorationsField,
    enterOnHit,
    publisher,
    atomic,
    blockTheme,
  ]
}
