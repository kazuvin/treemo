import type { EditorView } from '@codemirror/view'
import type { Command, KeyBinding } from '@/lib/command'
import {
  addChild,
  adjacentBlock,
  addSibling,
  centerSelection,
  deleteSubtree,
  editNode,
  enterDiagram,
  exitDiagram,
  indent,
  insertEmptyBlock,
  isOnTreeBlock,
  isDiagramActive,
  leaveBlock,
  moveSelection,
  openLineAroundBlock,
  outdent,
  paste,
  redoInDiagram,
  selectFirst,
  selectLastLeaf,
  setAllFolds,
  stepOntoBlock,
  swap,
  toggleFold,
  toggleFullscreen,
  searchInDiagram,
  toggleSource,
  undoInDiagram,
  yankSubtree,
} from './extensions/tree-actions'
import { useDiagramStore } from './stores/diagram-store'
import { DEFAULT_ZOOM, stepZoom } from './utils/zoom'

function diagramCommand(
  id: string,
  title: string,
  sequences: string[],
  run: (view: EditorView) => void,
): Command {
  return {
    id,
    title,
    keys: sequences.map((sequence): KeyBinding => ({ scope: 'diagram', sequence })),
    when: ({ view }) => view !== null && isDiagramActive(view.state),
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
    when: ({ view }) => view !== null && isOnTreeBlock(view.state) && !isDiagramActive(view.state),
    run: ({ view }) => {
      if (view) {
        run(view)
      }
    },
  }
}

/** 倍率はどのブロックにも効くので、DIAGRAM モードの外でもパレットから変えられる */
function zoomCommand(
  id: string,
  title: string,
  sequences: string[],
  next: (zoom: number) => number,
): Command {
  return {
    id,
    title,
    keys: sequences.map((sequence): KeyBinding => ({ scope: 'diagram', sequence })),
    run: () => {
      const store = useDiagramStore.getState()
      store.setZoom(next(store.zoom))
    },
  }
}

export const diagramCommands: Command[] = [
  {
    id: 'diagram.insertBlock',
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
    id: direction === 'down' ? 'diagram.stepDown' : 'diagram.stepUp',
    title: direction === 'down' ? '下のツリーブロックへ' : '上のツリーブロックへ',
    keys: [{ scope: 'normal', sequence: direction === 'down' ? 'j' : 'k' }],
    when: ({ view }) => view !== null && adjacentBlock(view.state, direction) !== null,
    run: ({ view }) => {
      if (view) {
        stepOntoBlock(view, direction)
      }
    },
  })),
  blockCommand('diagram.enter', 'DIAGRAM モードに入る', 'Enter', (view) => enterDiagram(view)),
  blockCommand('diagram.source', 'ツリーのソースを表示する', 'gs', (view) => toggleSource(view)),
  blockCommand('diagram.blockDown', 'ブロックの次の行へ', 'j', (view) => leaveBlock(view, 'down')),
  blockCommand('diagram.blockUp', 'ブロックの前の行へ', 'k', (view) => leaveBlock(view, 'up')),
  blockCommand('diagram.openBelow', 'ブロックの下に行を足す', 'o', (view) =>
    openLineAroundBlock(view, 'below'),
  ),
  blockCommand('diagram.openAbove', 'ブロックの上に行を足す', 'O', (view) =>
    openLineAroundBlock(view, 'above'),
  ),
  diagramCommand('diagram.parent', '親へ', ['h'], (view) => moveSelection(view, 'parent')),
  diagramCommand('diagram.child', '子へ', ['l'], (view) => moveSelection(view, 'child')),
  diagramCommand('diagram.next', '下の兄弟へ', ['j'], (view) => moveSelection(view, 'down')),
  diagramCommand('diagram.prev', '上の兄弟へ', ['k'], (view) => moveSelection(view, 'up')),
  diagramCommand('diagram.first', '最初のルートへ', ['gg'], selectFirst),
  diagramCommand('diagram.lastLeaf', '最後に見えている葉へ', ['G'], selectLastLeaf),
  diagramCommand('diagram.center', '選んでいるノードを中央に', ['zz'], centerSelection),
  diagramCommand('diagram.addBelow', '下に兄弟ノードを足す', ['o'], (view) =>
    addSibling(view, 'below'),
  ),
  diagramCommand('diagram.addAbove', '上に兄弟ノードを足す', ['O'], (view) =>
    addSibling(view, 'above'),
  ),
  diagramCommand('diagram.addChild', '子ノードを足す', ['Tab'], addChild),
  diagramCommand('diagram.editStart', '中身の先頭から書く', ['i'], (view) =>
    editNode(view, 'start'),
  ),
  diagramCommand('diagram.editEnd', '中身の末尾から書く', ['a'], (view) => editNode(view, 'end')),
  diagramCommand('diagram.change', '中身を書き直す', ['c'], (view) => editNode(view, 'empty')),
  diagramCommand('diagram.indent', '字下げする（部分木ごと）', ['>'], indent),
  diagramCommand('diagram.outdent', '字上げする（部分木ごと）', ['<'], outdent),
  diagramCommand('diagram.swapDown', '下の兄弟と入れ替える', ['J'], (view) => swap(view, 'down')),
  diagramCommand('diagram.swapUp', '上の兄弟と入れ替える', ['K'], (view) => swap(view, 'up')),
  diagramCommand('diagram.delete', '部分木を削除する', ['dd'], deleteSubtree),
  diagramCommand('diagram.yank', '部分木をコピーする', ['yy'], yankSubtree),
  diagramCommand('diagram.pasteBelow', '下に貼り付ける', ['p'], (view) => paste(view, 'below')),
  diagramCommand('diagram.pasteAbove', '上に貼り付ける', ['P'], (view) => paste(view, 'above')),
  diagramCommand('diagram.pasteChild', '最後の子として貼り付ける', [']p'], (view) =>
    paste(view, 'child'),
  ),
  diagramCommand('diagram.fold', '折りたたみを切り替える', ['za'], toggleFold),
  diagramCommand('diagram.unfoldAll', 'すべて開く', ['zR'], (view) => setAllFolds(view, false)),
  diagramCommand('diagram.foldAll', 'すべて折りたたむ', ['zM'], (view) => setAllFolds(view, true)),
  diagramCommand('diagram.undo', '取り消す', ['u'], undoInDiagram),
  diagramCommand('diagram.redo', 'やり直す', ['<C-r>'], redoInDiagram),
  zoomCommand('diagram.zoomIn', '図を拡大する', ['+', '='], (zoom) => stepZoom(zoom, 1)),
  zoomCommand('diagram.zoomOut', '図を縮小する', ['-'], (zoom) => stepZoom(zoom, -1)),
  zoomCommand('diagram.zoomReset', '図の倍率を 100% に戻す', ['0'], () => DEFAULT_ZOOM),
  diagramCommand('diagram.fullscreen', 'インラインと全画面を切り替える', ['F'], toggleFullscreen),
  diagramCommand('diagram.exit', 'DIAGRAM モードを出る', ['Esc', 'q'], exitDiagram),
  diagramCommand('diagram.searchNext', '次の検索の当たりへ', ['n'], (view) =>
    searchInDiagram(view, 'next'),
  ),
  diagramCommand('diagram.searchPrev', '前の検索の当たりへ', ['N'], (view) =>
    searchInDiagram(view, 'prev'),
  ),
]
