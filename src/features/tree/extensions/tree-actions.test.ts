import { history } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useStatusStore } from '@/stores/status-store'
import {
  addChild,
  addSibling,
  commitEdit,
  deleteSubtree,
  enterTree,
  exitTree,
  indent,
  insertEmptyBlock,
  isOnTreeBlock,
  isTreeActive,
  moveSelection,
  outdent,
  paste,
  selectLastLeaf,
  swap,
  toggleFold,
  toggleSource,
  undoInTree,
  yankSubtree,
} from './tree-actions'
import { treeExtension } from './tree-extension'
import { treeUiField } from './tree-state'

const before = '# メモ\n\n前の段落'
const after = '後ろの段落\n'

function setup(block: string): EditorView {
  const doc = `${before}\n${block}\n${after}`
  const from = before.length + 1
  return new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: { anchor: from },
      extensions: [history(), treeExtension()],
    }),
  })
}

function blockText(view: EditorView): string {
  const doc = view.state.doc.toString()
  expect(doc.startsWith(`${before}\n`)).toBe(true)
  expect(doc.endsWith(`\n${after}`)).toBe(true)
  return doc.slice(before.length + 1, doc.length - after.length - 1)
}

function selected(view: EditorView): number[] | null {
  return view.state.field(treeUiField).active?.path ?? null
}

async function flush(): Promise<void> {
  await new Promise((resolve) => queueMicrotask(() => resolve(undefined)))
}

let view: EditorView

afterEach(() => {
  view.destroy()
})

describe('entering and leaving', () => {
  it('enters TREE mode from the block and selects the first root', () => {
    view = setup('```tree\n- a\n  - b\n```')
    expect(isOnTreeBlock(view.state)).toBe(true)
    expect(enterTree(view)).toBe(true)
    expect(isTreeActive(view.state)).toBe(true)
    expect(selected(view)).toEqual([0])
  })

  it('refuses blocks with stray lines and explains why', () => {
    view = setup('```tree\nintro\n- a\n```')
    expect(enterTree(view)).toBe(false)
    expect(isTreeActive(view.state)).toBe(false)
    expect(useStatusStore.getState().message).toContain('gs')
  })

  it('does not touch the text when only moving around', () => {
    const block = '```tree\n* a\n    + b\n* c\n```'
    view = setup(block)
    enterTree(view)
    moveSelection(view, 'child')
    moveSelection(view, 'parent')
    moveSelection(view, 'down')
    exitTree(view)
    expect(blockText(view)).toBe(block)
    expect(isTreeActive(view.state)).toBe(false)
  })

  it('puts the cursor after the block when leaving', () => {
    view = setup('```tree\n- a\n```')
    enterTree(view)
    exitTree(view)
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    expect(line.text).toBe('後ろの段落')
  })
})

describe('building the tree', () => {
  it('adds a sibling, writes it and rewrites the block in canonical form', async () => {
    view = setup('```tree layout=lr\n* a\n```')
    enterTree(view)
    addSibling(view, 'below')
    expect(view.state.field(treeUiField).active?.editing).toMatchObject({ path: [1], isNew: true })
    commitEdit(view, 'b  ', 'done')
    await flush()
    expect(blockText(view)).toBe('```tree layout=lr\n- a\n- b\n```')
    expect(selected(view)).toEqual([1])
  })

  it('continues with the next sibling on Enter and drops it when left empty', () => {
    view = setup('```tree\n- a\n```')
    enterTree(view)
    addChild(view)
    commitEdit(view, 'child', 'sibling')
    expect(view.state.field(treeUiField).active?.editing?.path).toEqual([0, 1])
    commitEdit(view, '', 'sibling')
    expect(blockText(view)).toBe('```tree\n- a\n  - child\n```')
    expect(view.state.field(treeUiField).active?.editing).toBeNull()
  })

  it('removes a new node left empty with Esc', () => {
    view = setup('```tree\n- a\n```')
    enterTree(view)
    addSibling(view, 'above')
    commitEdit(view, '', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n```')
  })

  it('keeps multi-line content', () => {
    view = setup('```tree\n- a\n```')
    enterTree(view)
    addChild(view)
    commitEdit(view, '1 行目\n\n2 行目', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n  - 1 行目\n    2 行目\n```')
  })

  it('indents, outdents and swaps subtrees', () => {
    view = setup('```tree\n- a\n- b\n  - b1\n- c\n```')
    enterTree(view)
    moveSelection(view, 'down')
    indent(view)
    expect(blockText(view)).toBe('```tree\n- a\n  - b\n    - b1\n- c\n```')
    outdent(view)
    expect(blockText(view)).toBe('```tree\n- a\n- b\n  - b1\n- c\n```')
    swap(view, 'down')
    expect(blockText(view)).toBe('```tree\n- a\n- c\n- b\n  - b1\n```')
    expect(selected(view)).toEqual([2])
  })

  it('deletes into the register and pastes back', () => {
    view = setup('```tree\n- a\n  - a1\n- b\n```')
    enterTree(view)
    deleteSubtree(view)
    expect(blockText(view)).toBe('```tree\n- b\n```')
    paste(view, 'child')
    expect(blockText(view)).toBe('```tree\n- b\n  - a\n    - a1\n```')
    yankSubtree(view)
    paste(view, 'above')
    expect(blockText(view)).toBe('```tree\n- b\n  - a\n    - a1\n  - a\n    - a1\n```')
  })

  it('undoes one operation at a time with the note history', () => {
    view = setup('```tree\n- a\n```')
    enterTree(view)
    addSibling(view, 'below')
    commitEdit(view, 'b', 'done')
    addSibling(view, 'below')
    commitEdit(view, 'c', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n- b\n- c\n```')
    undoInTree(view)
    expect(blockText(view)).toBe('```tree\n- a\n- b\n-\n```')
    undoInTree(view)
    expect(blockText(view)).toBe('```tree\n- a\n- b\n```')
  })

  it('folds without changing the text and hides children from navigation', () => {
    view = setup('```tree\n- a\n  - b\n    - c\n```')
    enterTree(view)
    moveSelection(view, 'child')
    toggleFold(view)
    selectLastLeaf(view)
    expect(selected(view)).toEqual([0, 0])
    expect(blockText(view)).toBe('```tree\n- a\n  - b\n    - c\n```')
  })
})

describe('source view and new blocks', () => {
  it('shows the source and returns to the picture when the cursor leaves', () => {
    view = setup('```tree\n- a\n```')
    expect(toggleSource(view)).toBe(true)
    expect(view.state.field(treeUiField).source).not.toBeNull()
    expect(isOnTreeBlock(view.state)).toBe(false)
    view.dispatch({ selection: { anchor: 0 } })
    expect(view.state.field(treeUiField).source).toBeNull()
  })

  it('inserts an empty block on an empty line and starts editing', () => {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: 'text\n\nmore',
        selection: { anchor: 5 },
        extensions: [history(), treeExtension()],
      }),
    })
    insertEmptyBlock(view)
    expect(view.state.doc.toString()).toBe('text\n```tree\n-\n```\nmore')
    commitEdit(view, 'root', 'done')
    expect(view.state.doc.toString()).toBe('text\n```tree\n- root\n```\nmore')
  })
})
