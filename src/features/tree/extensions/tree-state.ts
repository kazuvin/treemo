import { type SearchQuery, setSearchQuery } from '@codemirror/search'
import { Annotation, type EditorState, StateEffect, StateField } from '@codemirror/state'
import type { TreeBlock, TreeNode } from '../types/tree'
import { type BlockRange, findTreeBlocks } from '../utils/find-blocks'
import { applyCollapsed, clampPath } from '../utils/ops'
import { parseTreeBlock } from '../utils/parse'

export interface ParsedBlock extends BlockRange {
  block: TreeBlock
}

export interface Editing {
  path: number[]
  cursor: 'start' | 'end' | 'empty'
  /** o / Tab などで足したばかりのノード。空のまま抜けたら消す */
  isNew: boolean
}

export interface ActiveTree {
  /** 操作中のブロックの開始位置 */
  from: number
  path: number[] | null
  editing: Editing | null
  fullscreen: boolean
  /** `l` で戻る子。親の ID → 子の添字 */
  lastChild: Record<string, number>
}

export interface TreeUi {
  active: ActiveTree | null
  /** ソース表示にしているブロックの開始位置 */
  source: number | null
  /** ブロックの開始位置 → 折りたたんだノードの ID */
  folds: ReadonlyMap<number, ReadonlySet<string>>
}

const PARSE_CACHE_LIMIT = 256
const parseCache = new Map<string, TreeBlock | null>()

/** 変わっていないブロックは読み直さない */
function parseCached(source: string): TreeBlock | null {
  const hit = parseCache.get(source)
  if (hit !== undefined) {
    return hit
  }
  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    parseCache.clear()
  }
  const parsed = parseTreeBlock(source)
  parseCache.set(source, parsed)
  return parsed
}

function scanBlocks(state: EditorState): ParsedBlock[] {
  const out: ParsedBlock[] = []
  for (const range of findTreeBlocks(state.doc)) {
    const block = parseCached(range.source)
    if (block) {
      out.push({ ...range, block })
    }
  }
  return out
}

export const blocksField = StateField.define<ParsedBlock[]>({
  create: scanBlocks,
  update: (blocks, tr) => (tr.docChanged ? scanBlocks(tr.state) : blocks),
})

/** codemirror-vim は、検索を光らせている間だけ forVim を立てた問い合わせを流す（`:noh` で降ろす） */
function toHighlight(query: SearchQuery & { forVim?: boolean }): RegExp | null {
  if (!query.forVim || !query.valid || query.search === '') {
    return null
  }
  try {
    return new RegExp(query.search, query.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

/** Vim が本文で光らせている検索。ツリーの絵の中でも同じ語を光らせる（docs/tree-block.md の「検索」） */
export const searchHighlightField = StateField.define<RegExp | null>({
  create: () => null,
  update: (value, tr) => {
    let next = value
    for (const effect of tr.effects) {
      if (effect.is(setSearchQuery)) {
        next = toHighlight(effect.value)
      }
    }
    return next
  },
})

export const updateTreeUi = StateEffect.define<(ui: TreeUi) => TreeUi>()

const initialUi: TreeUi = { active: null, source: null, folds: new Map() }

function blockAt(blocks: readonly ParsedBlock[], pos: number): ParsedBlock | null {
  return blocks.find((b) => b.from <= pos && pos <= b.to) ?? null
}

function blockStartingAt(blocks: readonly ParsedBlock[], from: number): ParsedBlock | null {
  return blocks.find((b) => b.from === from) ?? null
}

const EMPTY_FOLDS: ReadonlySet<string> = new Set()
/** 選択が動くたびに作り直すと、描画側が全ノードを測り直してしまう。解析結果と折りたたみが同じなら使い回す */
const rootsCache = new WeakMap<TreeBlock, { folds: ReadonlySet<string>; roots: TreeNode[] }>()

/**
 * 折りたたみを反映した、描画と操作に使うノード。ブロックの解析結果は書き換えない。
 * 返す配列は共有されるので、呼ぶ側も書き換えない（ops は複製してから変える）。
 */
export function rootsOf(block: ParsedBlock, ui: TreeUi): TreeNode[] {
  const folds = ui.folds.get(block.from) ?? EMPTY_FOLDS
  const hit = rootsCache.get(block.block)
  if (hit?.folds === folds) {
    return hit.roots
  }
  const clone = (nodes: readonly TreeNode[]): TreeNode[] =>
    nodes.map((node) => ({ ...node, children: clone(node.children) }))
  const roots = clone(block.block.roots)
  applyCollapsed(roots, folds)
  rootsCache.set(block.block, { folds, roots })
  return roots
}

export const treeUiField = StateField.define<TreeUi>({
  create: () => initialUi,
  update: (value, tr) => {
    let ui = value
    if (tr.docChanged) {
      const folds = new Map<number, ReadonlySet<string>>()
      for (const [from, ids] of ui.folds) {
        folds.set(tr.changes.mapPos(from, -1), ids)
      }
      ui = {
        active: ui.active ? { ...ui.active, from: tr.changes.mapPos(ui.active.from, -1) } : null,
        source: ui.source === null ? null : tr.changes.mapPos(ui.source, -1),
        folds,
      }
    }
    for (const effect of tr.effects) {
      if (effect.is(updateTreeUi)) {
        ui = effect.value(ui)
      }
    }
    const blocks = tr.state.field(blocksField)
    if (ui.active) {
      const block = blockStartingAt(blocks, ui.active.from)
      if (!block || block.block.strayLines.length > 0) {
        ui = { ...ui, active: null }
      } else if (!ui.active.editing) {
        const path = clampPath(rootsOf(block, ui), ui.active.path)
        if (path?.join('.') !== ui.active.path?.join('.')) {
          ui = { ...ui, active: { ...ui.active, path } }
        }
      }
    }
    if (ui.source !== null) {
      const block = blockStartingAt(blocks, ui.source)
      const head = tr.state.selection.main.head
      if (!block || head < block.from || head > block.to) {
        ui = { ...ui, source: null }
      }
    }
    return ui
  },
})

/**
 * カーソルがブロックの中の行（フェンスより内側）にあれば、その行を含む見えているノード。
 * Vim の `/` はテキストを探してカーソルをここへ置くので、当たったノードとして見せる
 * （docs/tree-block.md の「検索」）。折りたたんだ子孫に当たったら、閉じている祖先を返す
 */
export function hitPathAtCursor(state: EditorState): number[] | null {
  const block = blockAtCursor(state)
  const ui = state.field(treeUiField)
  if (!block || ui.active?.from === block.from) {
    return null
  }
  const doc = state.doc
  const first = doc.lineAt(block.from).number
  const line = doc.lineAt(state.selection.main.head).number - first
  if (line <= 0 || line >= doc.lineAt(block.to).number - first) {
    return null
  }
  return nodeAtLine(rootsOf(block, ui), line)?.id.split('.').map(Number) ?? null
}

/**
 * ブロックの中で、見えているノードが占める行（0 が開始フェンス）の最初と最後。
 * 閉じたノードは、隠れている子孫の行も含む
 */
export function nodeLineSpan(
  state: EditorState,
  block: ParsedBlock,
  path: readonly number[],
): [number, number] | null {
  const visible: TreeNode[] = []
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      visible.push(node)
      if (!node.collapsed) {
        walk(node.children)
      }
    }
  }
  walk(rootsOf(block, state.field(treeUiField)))
  const id = path.join('.')
  const i = visible.findIndex((node) => node.id === id)
  const line = visible[i]?.line
  if (line === undefined) {
    return null
  }
  const next = visible.slice(i + 1).find((node) => node.line !== undefined)?.line
  const doc = state.doc
  const closing = doc.lineAt(block.to).number - doc.lineAt(block.from).number
  return [line, (next ?? closing) - 1]
}

/** カーソルをブロックの中の行に置いても、TREE モードに入らせない（TREE モードの n / N が使う） */
export const keepCursorInBlock = Annotation.define<boolean>()

/** 行はノードの並び（行きがけ順）と同じ順なので、その行より前で最後に始まるノードを探す */
function nodeAtLine(nodes: readonly TreeNode[], line: number): TreeNode | null {
  let hit: TreeNode | null = null
  for (const node of nodes) {
    if (node.line === undefined || node.line > line) {
      break
    }
    hit = node
  }
  if (!hit || hit.collapsed) {
    return hit
  }
  return nodeAtLine(hit.children, line) ?? hit
}

/** カーソルが乗っているブロック。ソース表示のブロックは含めない */
export function blockAtCursor(state: EditorState): ParsedBlock | null {
  const ui = state.field(treeUiField)
  const block = blockAt(state.field(blocksField), state.selection.main.head)
  return block && block.from !== ui.source ? block : null
}

export function activeBlock(state: EditorState): ParsedBlock | null {
  const active = state.field(treeUiField).active
  return active ? blockStartingAt(state.field(blocksField), active.from) : null
}
