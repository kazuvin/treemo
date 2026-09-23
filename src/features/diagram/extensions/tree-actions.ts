/**
 * DIAGRAM モードの操作を、ブロックを正規形で書き直す 1 回のトランザクションとして発行する
 * （docs/architecture.md の「1 本の文書、1 本の履歴」）。
 */
import { isolateHistory, redo, undo } from '@codemirror/commands'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { getCM, Vim } from '@replit/codemirror-vim'
import { useStatusStore } from '@/stores/status-store'
import { useDiagramStore } from '../stores/diagram-store'
import type { TreeNode } from '../types/tree'
import {
  appendChild,
  collapsedIds,
  emptyNode,
  getNode,
  indentNode,
  insertSibling,
  type OpResult,
  outdentNode,
  removeNode,
  sameDepthNeighbor,
  setAllCollapsed,
  setContent,
  swapNode,
  toggleCollapsed,
  visiblePaths,
} from '../utils/ops'
import { parseNodes } from '../utils/parse'
import { normalizeContent, serializeNodes, serializeTreeBlock } from '../utils/serialize'
import {
  type ActiveTree,
  activeBlock,
  blockAtCursor,
  blocksField,
  type Editing,
  hitPathAtCursor,
  keepCursorInBlock,
  nodeLineSpan,
  type ParsedBlock,
  rootsOf,
  treeUiField,
  updateTreeUi,
} from './tree-state'

const EMPTY_BLOCK = '```tree\n-\n```'

function current(state: EditorState) {
  const ui = state.field(treeUiField)
  const block = activeBlock(state)
  if (!ui.active || !block) {
    return null
  }
  return { ui, active: ui.active, block, roots: rootsOf(block, ui) }
}

function patchActive(patch: Partial<ActiveTree>) {
  return updateTreeUi.of((ui) => (ui.active ? { ...ui, active: { ...ui.active, ...patch } } : ui))
}

/** ツリーを書き換える。ブロックの外には触らない */
function commitTree(
  view: EditorView,
  block: ParsedBlock,
  roots: TreeNode[],
  patch: Partial<ActiveTree>,
): void {
  const insert = serializeTreeBlock({ ...block.block, roots })
  const folds = new Set(collapsedIds(roots))
  const changed = insert !== block.source
  view.dispatch({
    changes: changed ? { from: block.from, to: block.to, insert } : undefined,
    selection: { anchor: block.from },
    effects: updateTreeUi.of((ui) => ({
      ...ui,
      active: ui.active ? { ...ui.active, ...patch } : null,
      folds: new Map(ui.folds).set(block.from, folds),
    })),
    annotations: changed ? isolateHistory.of('full') : undefined,
    userEvent: changed ? 'diagram.edit' : 'diagram.select',
  })
}

function withTree(
  view: EditorView,
  op: (roots: TreeNode[], path: number[] | null) => OpResult | null,
  patch: (result: OpResult) => Partial<ActiveTree> = (r) => ({ path: r.path }),
): boolean {
  const cur = current(view.state)
  if (!cur || cur.active.editing) {
    return false
  }
  const result = op(cur.roots, cur.active.path)
  if (!result) {
    return false
  }
  commitTree(view, cur.block, result.roots, patch(result))
  return true
}

export function isDiagramActive(state: EditorState): boolean {
  return state.field(treeUiField).active !== null
}

export function isOnTreeBlock(state: EditorState): boolean {
  return blockAtCursor(state) !== null
}

export function enterDiagram(view: EditorView, from?: number, path?: number[]): boolean {
  const blocks = view.state.field(blocksField)
  const block = from === undefined ? blockAtCursor(view.state) : blocks.find((b) => b.from === from)
  if (!block) {
    return false
  }
  if (block.block.strayLines.length > 0) {
    useStatusStore
      .getState()
      .show('読めない行があるので DIAGRAM モードに入れません。gs でソースを直してください')
    view.dispatch({ selection: { anchor: block.from } })
    return false
  }
  const hit = from === undefined ? hitPathAtCursor(view.state) : null
  view.dispatch(enterTreeSpec(view.state, block, path ?? hit))
  view.focus()
  return true
}

/** ブロックの DIAGRAM モードに入る変更。path が無ければ最初のルートを選ぶ */
export function enterTreeSpec(
  state: EditorState,
  block: ParsedBlock,
  path: number[] | null,
): TransactionSpec {
  const ui = state.field(treeUiField)
  const roots = rootsOf(block, ui)
  const fullscreen =
    ui.active?.from === block.from
      ? ui.active.fullscreen
      : useDiagramStore.getState().preferFullscreen
  return {
    selection: { anchor: block.from },
    effects: updateTreeUi.of((u) => ({
      ...u,
      source: null,
      active: {
        from: block.from,
        path: path ?? (roots.length > 0 ? [0] : null),
        editing: null,
        fullscreen,
        lastChild: {},
      },
    })),
  }
}

/**
 * DIAGRAM モードの n / N（docs/tree-block.md の「検索」）。選んでいるノードの後ろ（前）に
 * カーソルを置いて、本文の Vim の検索を続ける。当たった先がノードなら、そこで DIAGRAM モードに入り直す
 */
export function searchInDiagram(view: EditorView, direction: 'next' | 'prev'): void {
  const cur = current(view.state)
  const cm = getCM(view)
  const path = cur?.active.path
  if (!cur || !cm || !path) {
    return
  }
  const span = nodeLineSpan(view.state, cur.block, path)
  if (!span) {
    return
  }
  const doc = view.state.doc
  const first = doc.lineAt(cur.block.from).number
  const anchor =
    direction === 'next' ? doc.line(first + span[1]).to : doc.line(first + span[0]).from
  view.dispatch({
    selection: { anchor },
    effects: updateTreeUi.of((ui) => ({ ...ui, active: null })),
    annotations: keepCursorInBlock.of(true),
  })
  Vim.handleKey(cm, direction === 'next' ? 'n' : 'N', 'user')
  // 検索語が無いなどで動かなかったら、元のノードに戻る
  if (!isDiagramActive(view.state) && view.state.selection.main.head === anchor) {
    enterDiagram(view, cur.block.from, path)
  }
}

export function exitDiagram(view: EditorView): void {
  const block = activeBlock(view.state)
  const doc = view.state.doc
  const after = block ? Math.min(block.to + 1, doc.length) : view.state.selection.main.head
  view.dispatch({
    selection: { anchor: after },
    effects: updateTreeUi.of((ui) => ({ ...ui, active: null })),
    scrollIntoView: true,
  })
  view.focus()
}

export function selectBlock(view: EditorView, from: number): void {
  view.dispatch({ selection: { anchor: from } })
  view.focus()
}

export function selectNode(view: EditorView, from: number, path: number[]): void {
  const ui = view.state.field(treeUiField)
  if (ui.active?.editing) {
    return
  }
  if (ui.active?.from === from) {
    view.dispatch({ effects: patchActive({ path }) })
    view.focus()
    return
  }
  enterDiagram(view, from, path)
}

export function toggleSource(view: EditorView): boolean {
  const block = blockAtCursor(view.state)
  if (!block) {
    return false
  }
  const firstBody = view.state.doc.lineAt(block.from).to + 1
  view.dispatch({
    selection: { anchor: Math.min(firstBody, block.to) },
    effects: updateTreeUi.of((ui) => ({ ...ui, source: block.from, active: null })),
  })
  return true
}

/** ブロックを飛び越えて前後の行へ */
export function leaveBlock(view: EditorView, direction: 'up' | 'down'): boolean {
  const block = blockAtCursor(view.state)
  if (!block) {
    return false
  }
  const doc = view.state.doc
  const target =
    direction === 'down'
      ? Math.min(block.to + 1, doc.length)
      : Math.max(doc.lineAt(Math.max(block.from - 1, 0)).from, 0)
  if (direction === 'up' && block.from === 0) {
    return true
  }
  view.dispatch({ selection: { anchor: target }, scrollIntoView: true })
  return true
}

/** ブロックの上か下に空行を足して INSERT に入る（ブロックの上での o / O） */
export function openLineAroundBlock(view: EditorView, where: 'above' | 'below'): boolean {
  const block = blockAtCursor(view.state)
  if (!block) {
    return false
  }
  const pos = where === 'below' ? block.to : block.from
  view.dispatch({
    changes: { from: pos, insert: '\n' },
    selection: { anchor: where === 'below' ? pos + 1 : pos },
    scrollIntoView: true,
  })
  const cm = getCM(view)
  if (cm) {
    Vim.handleKey(cm, 'i', 'user')
  }
  return true
}

/** カーソルの行に空のツリーブロックを差し込み、最初のノードを書き始める（F-TREE-7） */
export function insertEmptyBlock(view: EditorView): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const empty = line.text.trim() === ''
  const from = empty ? line.from : line.to + 1
  const insert = empty ? EMPTY_BLOCK : `\n${EMPTY_BLOCK}`
  const at = empty ? line.from : line.to
  view.dispatch({
    changes: { from: at, to: empty ? line.to : at, insert },
    selection: { anchor: from },
    effects: updateTreeUi.of((ui) => ({
      ...ui,
      source: null,
      active: {
        from,
        path: [0],
        editing: { path: [0], cursor: 'end', isNew: true },
        fullscreen: useDiagramStore.getState().preferFullscreen,
        lastChild: {},
      },
    })),
    scrollIntoView: true,
    annotations: isolateHistory.of('full'),
  })
  view.focus()
}

export function moveSelection(view: EditorView, direction: 'parent' | 'child' | 'up' | 'down') {
  const cur = current(view.state)
  if (!cur || !cur.active.path) {
    return
  }
  const path = cur.active.path
  const node = getNode(cur.roots, path)
  const key = path.join('.')
  let next: number[] | null = null
  const lastChild = { ...cur.active.lastChild }
  switch (direction) {
    case 'parent':
      if (path.length > 1) {
        next = path.slice(0, -1)
        lastChild[next.join('.')] = path.at(-1) ?? 0
      }
      break
    case 'child':
      if (node && node.children.length > 0 && !node.collapsed) {
        next = [...path, Math.min(lastChild[key] ?? 0, node.children.length - 1)]
      }
      break
    case 'up':
    case 'down':
      next = sameDepthNeighbor(cur.roots, path, direction)
      break
    default:
      break
  }
  if (next) {
    view.dispatch({ effects: patchActive({ path: next, lastChild }) })
  }
}

export function selectFirst(view: EditorView): void {
  const cur = current(view.state)
  if (cur && cur.roots.length > 0) {
    view.dispatch({ effects: patchActive({ path: [0] }) })
  }
}

export function selectLastLeaf(view: EditorView): void {
  const cur = current(view.state)
  const last = cur ? visiblePaths(cur.roots).at(-1) : undefined
  if (last) {
    view.dispatch({ effects: patchActive({ path: last }) })
  }
}

function startEditing(result: OpResult, editing: Omit<Editing, 'path'>): Partial<ActiveTree> {
  return {
    path: result.path,
    editing: result.path ? { ...editing, path: result.path } : null,
  }
}

export function addSibling(view: EditorView, where: 'above' | 'below'): void {
  withTree(
    view,
    (roots, path) => insertSibling(roots, path ?? [], where),
    (r) => startEditing(r, { cursor: 'end', isNew: true }),
  )
}

export function addChild(view: EditorView): void {
  withTree(
    view,
    (roots, path) => (path ? appendChild(roots, path) : insertSibling(roots, [], 'below')),
    (r) => startEditing(r, { cursor: 'end', isNew: true }),
  )
}

/** 印を押したとき。そのノードを選び、子か下の兄弟を足して書き始める */
export function addNodeAt(
  view: EditorView,
  from: number,
  path: number[],
  where: 'child' | 'sibling',
): void {
  selectNode(view, from, path)
  if (where === 'child') {
    addChild(view)
  } else {
    addSibling(view, 'below')
  }
}

export function editNode(view: EditorView, cursor: Editing['cursor']): void {
  const cur = current(view.state)
  if (!cur || !cur.active.path || cur.active.editing) {
    return
  }
  view.dispatch({
    effects: patchActive({ editing: { path: cur.active.path, cursor, isNew: false } }),
  })
}

/**
 * ノード編集を確定する。next が 'sibling' / 'child' なら続けて次のノードを書き始める。
 * 空白だけのノードは作らない（docs/keybindings.md の「ノード編集」）。空で確定したら、
 * 子が無ければノードを消し、子があれば部分木を消さないよう編集前の中身に戻す。
 */
export function commitEdit(view: EditorView, text: string, next: 'sibling' | 'child' | 'done') {
  const cur = current(view.state)
  const editing = cur?.active.editing
  if (!cur || !editing) {
    return
  }
  const content = normalizeContent(text)
  if (content === '') {
    if ((getNode(cur.roots, editing.path)?.children.length ?? 0) > 0) {
      view.dispatch({ effects: patchActive({ editing: null }) })
    } else {
      const removed = removeNode(cur.roots, editing.path)
      commitTree(view, cur.block, removed.roots, { path: removed.path, editing: null })
    }
    view.focus()
    return
  }
  let result = setContent(cur.roots, editing.path, content)
  let patch: Partial<ActiveTree> = { path: result.path, editing: null }
  if (next === 'sibling') {
    result = insertSibling(result.roots, editing.path, 'below')
    patch = startEditing(result, { cursor: 'end', isNew: true })
  } else if (next === 'child') {
    result = appendChild(result.roots, editing.path)
    patch = startEditing(result, { cursor: 'end', isNew: true })
  }
  commitTree(view, cur.block, result.roots, patch)
  if (next === 'done') {
    view.focus()
  }
}

export function indent(view: EditorView): void {
  withTree(view, (roots, path) => (path ? indentNode(roots, path) : null))
}

export function outdent(view: EditorView): void {
  withTree(view, (roots, path) => (path ? outdentNode(roots, path) : null))
}

export function swap(view: EditorView, direction: 'up' | 'down'): void {
  withTree(view, (roots, path) => (path ? swapNode(roots, path, direction) : null))
}

/** 本文の Vim と同じ入口で入れる。ヤンクならクリップボードにも写る（clipboard の設定） */
function setRegister(nodes: readonly TreeNode[], operator: 'yank' | 'delete'): void {
  Vim.getRegisterController().pushText(null, operator, serializeNodes(nodes).join('\n'), true)
}

export function deleteSubtree(view: EditorView): void {
  withTree(view, (roots, path) => {
    if (!path) {
      return null
    }
    const result = removeNode(roots, path)
    if (result.removed) {
      setRegister([result.removed], 'delete')
    }
    return result
  })
}

export function yankSubtree(view: EditorView): void {
  const cur = current(view.state)
  const node = cur?.active.path ? getNode(cur.roots, cur.active.path) : null
  if (node) {
    setRegister([node], 'yank')
    useStatusStore.getState().show('部分木をコピーしました')
  }
}

/** レジスタのテキストをノードとして読む。箇条書きでなければ 1 行を 1 ノードにする */
function registerNodes(): TreeNode[] {
  const text = Vim.getRegisterController().getRegister('"').toString()
  const lines = text.replace(/\n$/, '').split('\n')
  const parsed = parseNodes(lines)
  if (parsed.roots.length > 0 && parsed.strayLines.length === 0) {
    return parsed.roots
  }
  return lines
    .map((line) => normalizeContent(line))
    .filter((line) => line !== '')
    .map((line) => emptyNode(line))
}

export function paste(view: EditorView, where: 'below' | 'above' | 'child'): void {
  const nodes = registerNodes()
  if (nodes.length === 0) {
    return
  }
  withTree(view, (roots, path) => {
    if (where === 'child' && path) {
      return appendChild(roots, path, nodes)
    }
    return insertSibling(roots, path ?? [], where === 'above' ? 'above' : 'below', nodes)
  })
}

export function toggleFold(view: EditorView): void {
  withTree(view, (roots, path) => (path ? toggleCollapsed(roots, path) : null))
}

export function setAllFolds(view: EditorView, collapsed: boolean): void {
  withTree(view, (roots, path) => ({ roots: setAllCollapsed(roots, collapsed), path }))
}

export function toggleFullscreen(view: EditorView): void {
  const cur = current(view.state)
  if (!cur) {
    return
  }
  const fullscreen = !cur.active.fullscreen
  useDiagramStore.getState().setPreferFullscreen(fullscreen)
  view.dispatch({ effects: patchActive({ fullscreen }) })
}

export function undoInDiagram(view: EditorView): void {
  undo(view)
}

export function redoInDiagram(view: EditorView): void {
  redo(view)
}

/** 選んでいるノードを画面の中央へ */
export function centerSelection(view: EditorView): void {
  const cur = current(view.state)
  if (!cur?.active.path) {
    return
  }
  const id = cur.active.path.join('.')
  const el = view.dom.ownerDocument.querySelector(
    `[data-diagram-active="true"] [data-node-id="${CSS.escape(id)}"]`,
  )
  el?.scrollIntoView({ block: 'center', inline: 'center' })
}

/** ブロックの順番 → 折りたたんだノードの ID。アプリの状態として保存する */
export function treeFolds(state: EditorState): Record<string, string[]> {
  const ui = state.field(treeUiField)
  const out: Record<string, string[]> = {}
  state.field(blocksField).forEach((block, index) => {
    const ids = ui.folds.get(block.from)
    if (ids && ids.size > 0) {
      out[String(index)] = [...ids]
    }
  })
  return out
}

export function restoreTreeFolds(view: EditorView, folds: Readonly<Record<string, string[]>>) {
  const blocks = view.state.field(blocksField)
  const map = new Map<number, ReadonlySet<string>>()
  for (const [index, ids] of Object.entries(folds)) {
    const block = blocks[Number(index)]
    if (block) {
      map.set(block.from, new Set(ids))
    }
  }
  if (map.size > 0) {
    view.dispatch({ effects: updateTreeUi.of((ui) => ({ ...ui, folds: map })) })
  }
}

/** カーソルの次（前）の行から始まる（で終わる）ブロック */
export function adjacentBlock(state: EditorState, direction: 'up' | 'down'): ParsedBlock | null {
  if (blockAtCursor(state)) {
    return null
  }
  const line = state.doc.lineAt(state.selection.main.head)
  const blocks = state.field(blocksField)
  if (direction === 'down') {
    return blocks.find((b) => b.from === line.to + 1) ?? null
  }
  return blocks.find((b) => b.to === line.from - 1) ?? null
}

/** Vim の j / k はブロックの絵の中に入れないので、隣の行からはここでブロックに乗せる */
export function stepOntoBlock(view: EditorView, direction: 'up' | 'down'): boolean {
  const block = adjacentBlock(view.state, direction)
  if (!block) {
    return false
  }
  view.dispatch({ selection: { anchor: block.from }, scrollIntoView: true })
  return true
}
