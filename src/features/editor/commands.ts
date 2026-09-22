import type { EditorView } from '@codemirror/view'
import type { Command } from '@/lib/command'
import { feedVimKeys } from './extensions/vim-bridge'
import { indentItem, type LineEdit, moveItem, outdentItem, toggleTask } from './utils/list-ops'

function lines(view: EditorView): string[] {
  return view.state.doc.toString().split('\n')
}

function cursorLineIndex(view: EditorView): number {
  return view.state.doc.lineAt(view.state.selection.main.head).number - 1
}

function applyLineEdit(view: EditorView, edit: LineEdit): void {
  const { doc } = view.state
  const from = doc.line(edit.from + 1).from
  const to = doc.line(edit.to + 1).to
  const insert = edit.lines.join('\n')
  const head = view.state.selection.main.head
  const column = head - doc.lineAt(head).from
  view.dispatch({
    changes: { from, to, insert },
    userEvent: 'edit.outline',
  })
  const line = view.state.doc.line(edit.cursorLine + 1)
  view.dispatch({ selection: { anchor: Math.min(line.from + column, line.to) } })
}

function lineCommand(
  id: string,
  title: string,
  sequence: string,
  op: (lines: string[], index: number) => LineEdit | null,
): Command {
  return {
    id,
    title,
    keys: [{ scope: 'editor', sequence }],
    when: (ctx) => ctx.view !== null,
    run: ({ view }) => {
      if (!view) {
        return
      }
      const edit = op(lines(view), cursorLineIndex(view))
      if (edit) {
        applyLineEdit(view, edit)
      }
    },
  }
}

export const editorCommands: Command[] = [
  {
    id: 'editor.toggleTask',
    title: 'チェックボックスを切り替える',
    keys: [{ scope: 'normal', sequence: '<Space>x' }],
    when: (ctx) => ctx.view !== null,
    run: ({ view }) => {
      if (!view) {
        return
      }
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      const next = toggleTask(line.text)
      if (next !== null) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: next } })
      }
    },
  },
  lineCommand('editor.indentItem', 'リスト項目を字下げする', '<M-l>', indentItem),
  lineCommand('editor.outdentItem', 'リスト項目を字上げする', '<M-h>', outdentItem),
  lineCommand('editor.moveItemDown', 'リスト項目を下へ移す', '<M-j>', (l, i) =>
    moveItem(l, i, 'down'),
  ),
  lineCommand('editor.moveItemUp', 'リスト項目を上へ移す', '<M-k>', (l, i) => moveItem(l, i, 'up')),
  ...(
    [
      ['editor.foldToggle', '折りたたみを切り替える', 'za'],
      ['editor.foldOpen', '折りたたみを開く', 'zo'],
      ['editor.foldClose', '折りたたむ', 'zc'],
      ['editor.foldOpenAll', 'すべて開く', 'zR'],
      ['editor.foldCloseAll', 'すべて折りたたむ', 'zM'],
    ] as const
  ).map(([id, title, sequence]): Command => ({
    id,
    title,
    keys: [{ scope: 'normal', sequence, passive: true }],
    when: (ctx) => ctx.view !== null,
    run: ({ view }) => {
      if (view) {
        feedVimKeys(view, sequence.split(''))
      }
    },
  })),
]
