import { type EditorState, type Extension, type Range, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import { useModeStore } from '@/stores/mode-store'
import { useTreeStore } from '../stores/tree-store'
import { collapsedIds } from '../utils/ops'
import { activeBlock, blockAtCursor, blocksField, rootsOf, treeUiField } from './tree-state'
import { TreeWidget } from './tree-widget'

function buildDecorations(state: EditorState): DecorationSet {
  const ui = state.field(treeUiField)
  const onBlock = blockAtCursor(state)
  const ranges: Range<Decoration>[] = []
  for (const block of state.field(blocksField)) {
    if (block.from === ui.source) {
      continue
    }
    const active = ui.active?.from === block.from ? ui.active : null
    let status: 'idle' | 'selected' | 'tree' | 'fullscreen' = 'idle'
    if (active) {
      status = active.fullscreen ? 'fullscreen' : 'tree'
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
      tr.startState.field(treeUiField) !== tr.state.field(treeUiField)
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
  if (mode.tree !== (ui.active !== null)) {
    mode.setTree(ui.active !== null)
  }
  if (mode.onTreeBlock !== onBlock) {
    mode.setOnTreeBlock(onBlock)
  }
  const block = activeBlock(state)
  const tree = useTreeStore.getState()
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
        update.startState.field(treeUiField) !== update.state.field(treeUiField)
      ) {
        publish(update.state)
      }
    },
    destroy: () => {
      useModeStore.getState().setTree(false)
      useModeStore.getState().setOnTreeBlock(false)
      useTreeStore.getState().setActive(null)
    },
  }
})

/** ブロックの絵が占める範囲は、カーソルの移動では 1 つのまとまりとして飛ばす */
const atomic = EditorView.atomicRanges.of((view) => view.state.field(decorationsField))

/** ブロックの上では本文のカーソルがブロックの端に残って見えるので隠す。選択状態は枠で示す */
const hideCursorOnBlock = [
  EditorView.editorAttributes.of((view) =>
    blockAtCursor(view.state) ? { class: 'cm-on-tree-block' } : null,
  ),
  EditorView.theme({
    '&.cm-on-tree-block .cm-fat-cursor, &.cm-on-tree-block .cm-cursor': {
      visibility: 'hidden',
    },
  }),
]

/** エディタにツリーブロックを載せる拡張。app が features/editor に渡す */
export function treeExtension(): Extension {
  return [blocksField, treeUiField, decorationsField, publisher, atomic, hideCursorOnBlock]
}
