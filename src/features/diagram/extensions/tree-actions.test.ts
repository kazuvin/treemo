import { history } from '@codemirror/commands'
import { SearchQuery, setSearchQuery } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import { readingField, setReading } from '@/lib/reading'
import { useStatusStore } from '@/stores/status-store'
import {
  addChild,
  addSibling,
  commitEdit,
  deleteSubtree,
  editNode,
  enterDiagram,
  exitDiagram,
  indent,
  insertEmptyBlock,
  isOnTreeBlock,
  isDiagramActive,
  moveSelection,
  outdent,
  paste,
  searchInDiagram,
  selectLastLeaf,
  swap,
  toggleFold,
  toggleSource,
  undoInDiagram,
  yankSubtree,
} from './tree-actions'
import { treeExtension } from './tree-extension'
import { hitPathAtCursor, keepCursorInBlock, searchHighlightField, treeUiField } from './tree-state'

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
      extensions: [history(), treeExtension(), readingField],
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
  it('enters DIAGRAM mode from the block and selects the first root', () => {
    view = setup('```tree\n- a\n  - b\n```')
    expect(isOnTreeBlock(view.state)).toBe(true)
    expect(enterDiagram(view)).toBe(true)
    expect(isDiagramActive(view.state)).toBe(true)
    expect(selected(view)).toEqual([0])
  })

  it('does not step onto or enter blocks in reading mode', () => {
    view = setup('```tree\n- a\n```')
    view.dispatch({ effects: setReading.of(true) })
    expect(isOnTreeBlock(view.state)).toBe(false)
    expect(enterDiagram(view)).toBe(false)
    insertEmptyBlock(view)
    expect(blockText(view)).toBe('```tree\n- a\n```')
  })

  it('refuses blocks with stray lines and explains why', () => {
    view = setup('```tree\nintro\n- a\n```')
    expect(enterDiagram(view)).toBe(false)
    expect(isDiagramActive(view.state)).toBe(false)
    expect(useStatusStore.getState().message).toContain('gs')
  })

  it('does not touch the text when only moving around', () => {
    const block = '```tree\n* a\n    + b\n* c\n```'
    view = setup(block)
    enterDiagram(view)
    moveSelection(view, 'child')
    moveSelection(view, 'parent')
    moveSelection(view, 'down')
    exitDiagram(view)
    expect(blockText(view)).toBe(block)
    expect(isDiagramActive(view.state)).toBe(false)
  })

  it('puts the cursor after the block when leaving', () => {
    view = setup('```tree\n- a\n```')
    enterDiagram(view)
    exitDiagram(view)
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    expect(line.text).toBe('後ろの段落')
  })
})

describe('building the tree', () => {
  it('adds a sibling, writes it and rewrites the block in canonical form', async () => {
    view = setup('```tree layout=lr\n* a\n```')
    enterDiagram(view)
    addSibling(view, 'below')
    expect(view.state.field(treeUiField).active?.editing).toMatchObject({ path: [1], isNew: true })
    commitEdit(view, 'b  ', 'done')
    await flush()
    expect(blockText(view)).toBe('```tree layout=lr\n- a\n- b\n```')
    expect(selected(view)).toEqual([1])
  })

  it('continues with the next sibling on Enter and drops it when left empty', () => {
    view = setup('```tree\n- a\n```')
    enterDiagram(view)
    addChild(view)
    commitEdit(view, 'child', 'sibling')
    expect(view.state.field(treeUiField).active?.editing?.path).toEqual([0, 1])
    commitEdit(view, '', 'sibling')
    expect(blockText(view)).toBe('```tree\n- a\n  - child\n```')
    expect(view.state.field(treeUiField).active?.editing).toBeNull()
  })

  it('removes a new node left empty with Esc', () => {
    view = setup('```tree\n- a\n```')
    enterDiagram(view)
    addSibling(view, 'above')
    commitEdit(view, '', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n```')
  })

  it('removes an existing leaf emptied with Esc', () => {
    view = setup('```tree\n- a\n- b\n```')
    enterDiagram(view)
    moveSelection(view, 'down')
    editNode(view, 'end')
    commitEdit(view, '   ', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n```')
  })

  it('restores an emptied node that has children instead of dropping its subtree', () => {
    view = setup('```tree\n- a\n  - b\n```')
    enterDiagram(view)
    editNode(view, 'end')
    commitEdit(view, ' ', 'sibling')
    expect(blockText(view)).toBe('```tree\n- a\n  - b\n```')
    expect(view.state.field(treeUiField).active?.editing).toBeNull()
  })

  it('keeps multi-line content', () => {
    view = setup('```tree\n- a\n```')
    enterDiagram(view)
    addChild(view)
    commitEdit(view, '1 行目\n\n2 行目', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n  - 1 行目\n    2 行目\n```')
  })

  it('indents, outdents and swaps subtrees', () => {
    view = setup('```tree\n- a\n- b\n  - b1\n- c\n```')
    enterDiagram(view)
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
    enterDiagram(view)
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
    enterDiagram(view)
    addSibling(view, 'below')
    commitEdit(view, 'b', 'done')
    addSibling(view, 'below')
    commitEdit(view, 'c', 'done')
    expect(blockText(view)).toBe('```tree\n- a\n- b\n- c\n```')
    undoInDiagram(view)
    expect(blockText(view)).toBe('```tree\n- a\n- b\n-\n```')
    undoInDiagram(view)
    expect(blockText(view)).toBe('```tree\n- a\n- b\n```')
  })

  it('folds without changing the text and hides children from navigation', () => {
    view = setup('```tree\n- a\n  - b\n    - c\n```')
    enterDiagram(view)
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

describe('search hits inside a block', () => {
  // Vim の `/` は、当たった文字の位置へカーソルを置くだけ。同じことをここで起こす
  function cursorAt(text: string, keep = false) {
    view.dispatch({
      selection: { anchor: view.state.doc.toString().indexOf(text) },
      annotations: keep ? keepCursorInBlock.of(true) : [],
    })
  }

  it('points at the node whose line holds the cursor, including continuation lines', () => {
    view = setup('```tree\n- a\n  - b\n    続き\n- c\n```')
    cursorAt('続き', true)
    expect(hitPathAtCursor(view.state)).toEqual([0, 0])
    cursorAt('c\n```', true)
    expect(hitPathAtCursor(view.state)).toEqual([1])
    cursorAt('```tree', true)
    expect(hitPathAtCursor(view.state)).toBeNull()
  })

  it('selects the hit node in DIAGRAM (NORMAL)', () => {
    view = setup('```tree\n- a\n  - b\n- c\n```')
    cursorAt('b\n')
    expect(isDiagramActive(view.state)).toBe(true)
    expect(selected(view)).toEqual([0, 0])
    expect(view.state.field(treeUiField).active?.editing).toBeNull()
  })

  it('selects the folded ancestor of a hidden hit', () => {
    view = setup('```tree\n- a\n  - b\n```')
    enterDiagram(view)
    toggleFold(view)
    exitDiagram(view)
    cursorAt('b\n```')
    expect(selected(view)).toEqual([0])
  })

  it('stays out of DIAGRAM mode for a block with stray lines and only points at the node', () => {
    view = setup('```tree\nintro\n- a\n```')
    cursorAt('a\n```')
    expect(isDiagramActive(view.state)).toBe(false)
    expect(hitPathAtCursor(view.state)).toEqual([0])
  })

  it('continues the search with n and N from the selected node', () => {
    const doc = '# beta\n```tree\n- beta one\n- two\n- beta three\n```\n'
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc, extensions: [vim(), treeExtension()] }),
    })
    const cm = getCM(view)
    if (!cm) {
      throw new Error('vim is missing')
    }
    view.dispatch({ selection: { anchor: 2 } })
    Vim.handleKey(cm, '*', 'user')
    expect(selected(view)).toEqual([0])
    searchInDiagram(view, 'next')
    expect(selected(view)).toEqual([2])
    searchInDiagram(view, 'next')
    expect(isDiagramActive(view.state)).toBe(false)
    expect(view.state.selection.main.head).toBe(2)
    Vim.handleKey(cm, 'N', 'user')
    expect(selected(view)).toEqual([2])
    searchInDiagram(view, 'prev')
    expect(selected(view)).toEqual([0])
  })

  it('follows the query Vim highlights and drops it on :noh', () => {
    view = setup('```tree\n- a\n```')
    const query = Object.assign(new SearchQuery({ search: 'Be.a', regexp: true }), { forVim: true })
    view.dispatch({ effects: setSearchQuery.of(query) })
    expect(view.state.field(searchHighlightField)?.flags).toBe('gi')
    query.forVim = false
    view.dispatch({ effects: setSearchQuery.of(query) })
    expect(view.state.field(searchHighlightField)).toBeNull()
  })
})
