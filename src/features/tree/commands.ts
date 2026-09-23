import type { EditorView } from '@codemirror/view'
import type { Command, KeyBinding } from '@/lib/command'
import {
  addChild,
  adjacentBlock,
  addSibling,
  centerSelection,
  deleteSubtree,
  editNode,
  enterTree,
  exitTree,
  indent,
  insertEmptyBlock,
  isOnTreeBlock,
  isTreeActive,
  leaveBlock,
  moveSelection,
  openLineAroundBlock,
  outdent,
  paste,
  redoInTree,
  selectFirst,
  selectLastLeaf,
  setAllFolds,
  stepOntoBlock,
  swap,
  toggleFold,
  toggleFullscreen,
  searchInTree,
  toggleSource,
  undoInTree,
  yankSubtree,
} from './extensions/tree-actions'

function treeCommand(
  id: string,
  title: string,
  sequences: string[],
  run: (view: EditorView) => void,
): Command {
  return {
    id,
    title,
    keys: sequences.map((sequence): KeyBinding => ({ scope: 'tree', sequence })),
    when: ({ view }) => view !== null && isTreeActive(view.state),
    run: ({ view }) => {
      if (view) {
        run(view)
      }
    },
  }
}

function blockCommand(
  id: string,
  title: string,
  sequence: string,
  run: (view: EditorView) => void,
): Command {
  return {
    id,
    title,
    keys: [{ scope: 'block', sequence }],
    when: ({ view }) => view !== null && isOnTreeBlock(view.state) && !isTreeActive(view.state),
    run: ({ view }) => {
      if (view) {
        run(view)
      }
    },
  }
}

export const treeCommands: Command[] = [
  {
    id: 'tree.insertBlock',
    title: '空のツリーブロックを差し込む',
    keys: [{ scope: 'normal', sequence: '<Space>tn' }],
    when: ({ view }) => view !== null,
    run: ({ view }) => {
      if (view) {
        insertEmptyBlock(view)
      }
    },
  },
  ...(['down', 'up'] as const).map((direction): Command => ({
    id: direction === 'down' ? 'tree.stepDown' : 'tree.stepUp',
    title: direction === 'down' ? '下のツリーブロックへ' : '上のツリーブロックへ',
    keys: [{ scope: 'normal', sequence: direction === 'down' ? 'j' : 'k' }],
    when: ({ view }) => view !== null && adjacentBlock(view.state, direction) !== null,
    run: ({ view }) => {
      if (view) {
        stepOntoBlock(view, direction)
      }
    },
  })),
  blockCommand('tree.enter', 'TREE モードに入る', 'Enter', (view) => enterTree(view)),
  blockCommand('tree.source', 'ツリーのソースを表示する', 'gs', (view) => toggleSource(view)),
  blockCommand('tree.blockDown', 'ブロックの次の行へ', 'j', (view) => leaveBlock(view, 'down')),
  blockCommand('tree.blockUp', 'ブロックの前の行へ', 'k', (view) => leaveBlock(view, 'up')),
  blockCommand('tree.openBelow', 'ブロックの下に行を足す', 'o', (view) =>
    openLineAroundBlock(view, 'below'),
  ),
  blockCommand('tree.openAbove', 'ブロックの上に行を足す', 'O', (view) =>
    openLineAroundBlock(view, 'above'),
  ),
  treeCommand('tree.parent', '親へ', ['h'], (view) => moveSelection(view, 'parent')),
  treeCommand('tree.child', '子へ', ['l'], (view) => moveSelection(view, 'child')),
  treeCommand('tree.next', '下の兄弟へ', ['j'], (view) => moveSelection(view, 'down')),
  treeCommand('tree.prev', '上の兄弟へ', ['k'], (view) => moveSelection(view, 'up')),
  treeCommand('tree.first', '最初のルートへ', ['gg'], selectFirst),
  treeCommand('tree.lastLeaf', '最後に見えている葉へ', ['G'], selectLastLeaf),
  treeCommand('tree.center', '選んでいるノードを中央に', ['zz'], centerSelection),
  treeCommand('tree.addBelow', '下に兄弟ノードを足す', ['o'], (view) => addSibling(view, 'below')),
  treeCommand('tree.addAbove', '上に兄弟ノードを足す', ['O'], (view) => addSibling(view, 'above')),
  treeCommand('tree.addChild', '子ノードを足す', ['Tab'], addChild),
  treeCommand('tree.editStart', '中身の先頭から書く', ['i'], (view) => editNode(view, 'start')),
  treeCommand('tree.editEnd', '中身の末尾から書く', ['a'], (view) => editNode(view, 'end')),
  treeCommand('tree.change', '中身を書き直す', ['c'], (view) => editNode(view, 'empty')),
  treeCommand('tree.indent', '字下げする（部分木ごと）', ['>'], indent),
  treeCommand('tree.outdent', '字上げする（部分木ごと）', ['<'], outdent),
  treeCommand('tree.swapDown', '下の兄弟と入れ替える', ['J'], (view) => swap(view, 'down')),
  treeCommand('tree.swapUp', '上の兄弟と入れ替える', ['K'], (view) => swap(view, 'up')),
  treeCommand('tree.delete', '部分木を削除する', ['dd'], deleteSubtree),
  treeCommand('tree.yank', '部分木をコピーする', ['yy'], yankSubtree),
  treeCommand('tree.pasteBelow', '下に貼り付ける', ['p'], (view) => paste(view, 'below')),
  treeCommand('tree.pasteAbove', '上に貼り付ける', ['P'], (view) => paste(view, 'above')),
  treeCommand('tree.pasteChild', '最後の子として貼り付ける', [']p'], (view) =>
    paste(view, 'child'),
  ),
  treeCommand('tree.fold', '折りたたみを切り替える', ['za'], toggleFold),
  treeCommand('tree.unfoldAll', 'すべて開く', ['zR'], (view) => setAllFolds(view, false)),
  treeCommand('tree.foldAll', 'すべて折りたたむ', ['zM'], (view) => setAllFolds(view, true)),
  treeCommand('tree.undo', '取り消す', ['u'], undoInTree),
  treeCommand('tree.redo', 'やり直す', ['<C-r>'], redoInTree),
  treeCommand('tree.fullscreen', 'インラインと全画面を切り替える', ['F'], toggleFullscreen),
  treeCommand('tree.exit', 'TREE モードを出る', ['Esc', 'q'], exitTree),
  treeCommand('tree.searchNext', '次の検索の当たりへ', ['n'], (view) => searchInTree(view, 'next')),
  treeCommand('tree.searchPrev', '前の検索の当たりへ', ['N'], (view) => searchInTree(view, 'prev')),
]
