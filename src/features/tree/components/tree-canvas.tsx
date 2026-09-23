import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Editing } from '../extensions/tree-state'
import { useTweenedRects } from '../hooks/use-tweened-rects'
import type { TreeNode } from '../types/tree'
import { edgePath, layoutTree, type Size } from '../utils/layout'
import { getNode } from '../utils/ops'
import { InlineContent } from './inline-content'
import { type CommitNext, NodeEditor } from './node-editor'

/**
 * 列のあいだは辺の折れ目と「子を足す」の印、兄弟のあいだは「兄弟を足す」の印が入る幅。
 * 印はこの隙間に重ねて出すので、出し入れしてもノードは動かない
 */
const LAYOUT = { columnGap: 48, siblingGap: 24 }
/** 印の高さ（text-2xs の行 16px + 枠）。兄弟のあいだの縦の中央に置く */
const SIGNIFIER_HEIGHT = 18
const SIGNIFIER_GAP = 4
const EDITING_KEY = '\u0000editing'

/** 描いて測るまでの仮の大きさ。等幅 14px の 1 文字をおよそ 8.4px とみる */
function estimate(node: TreeNode): Size {
  const lines = node.content.split('\n')
  const longest = Math.max(1, ...lines.map((line) => line.length))
  return { width: Math.min(longest, 32) * 8.4 + 18, height: lines.length * 20 + 10 }
}

function visibleNodes(roots: readonly TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      out.push(node)
      if (!node.collapsed) {
        walk(node.children)
      }
    }
  }
  walk(roots)
  return out
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

interface TreeCanvasProps {
  roots: TreeNode[]
  /** 選んでいるノードの ID。TREE モードでなければ null */
  selectedId: string | null
  /** 検索で当たったノードの ID。ブロックを選んでいるだけのとき（TREE モードの外）に示す */
  hitId?: string | null
  /** 中身の中で光らせる検索 */
  search?: RegExp | null
  editing: Editing | null
  /** 選んでいるノードの横と下に、ノードを足す印を出すか */
  showGuide: boolean
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onAddNode: (path: number[], where: 'child' | 'sibling') => void
  onCommit: (text: string, next: CommitNext) => void
}

function toPath(id: string): number[] {
  return id.split('.').map(Number)
}

export function TreeCanvas({
  roots,
  selectedId,
  hitId = null,
  search = null,
  editing,
  showGuide,
  onSelectNode,
  onEditNode,
  onAddNode,
  onCommit,
}: TreeCanvasProps) {
  // 大きさは中身だけで決まるので、中身をキーに覚える。操作でノードの ID がずれても測り直さずに済む
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(new Map())
  const [measureTick, setMeasureTick] = useState(0)
  // 空のまま Enter を押すとノードは消えて TREE (NORMAL) に戻り、Tab は何もしないので、
  // そのときは +Enter と +Tab を出さない
  const [editingHasText, setEditingHasText] = useState(false)
  const elements = useRef(new Map<string, HTMLElement>())
  const container = useRef<HTMLDivElement>(null)
  const editingId = editing?.path.join('.') ?? null
  const sizeKey = (node: TreeNode) => (node.id === editingId ? EDITING_KEY : node.content)

  const register = (id: string, el: HTMLElement | null) => {
    if (el) {
      elements.current.set(id, el)
    } else {
      elements.current.delete(id)
    }
  }

  const layout = layoutTree(roots, (node) => sizes.get(sizeKey(node)) ?? estimate(node), LAYOUT)
  const nodes = visibleNodes(roots)
  const tweened = useTweenedRects(nodes, layout.rects)
  const selectedRect = selectedId ? tweened.rect(selectedId) : undefined
  // TREE (INSERT) では Enter が下の兄弟、Tab が子（docs/keybindings.md の「ノード編集」）
  const siblingKey = editing ? 'Enter' : 'o'
  const guideHidden = editing !== null && !editingHasText
  const selectedNode = selectedId ? getNode(roots, toPath(selectedId)) : null

  useLayoutEffect(() => {
    const byId = new Map(visibleNodes(roots).map((node) => [node.id, node]))
    let next: Map<string, Size> | null = null
    for (const [id, el] of elements.current) {
      const node = byId.get(id)
      // ウィジェットの DOM は文書に入る前に一度描かれる。そのときは測れないので仮の大きさのまま
      if (!node || !el.isConnected || el.offsetWidth === 0) {
        continue
      }
      const key = id === editingId ? EDITING_KEY : node.content
      const prev = sizes.get(key)
      if (prev && key !== EDITING_KEY) {
        continue
      }
      const size = { width: el.offsetWidth, height: el.offsetHeight }
      if (!prev || prev.width !== size.width || prev.height !== size.height) {
        next ??= new Map(sizes)
        next.set(key, size)
      }
    }
    if (next) {
      // 描いたノードの大きさを測ってから配置し直す（docs/tree-block.md の「レイアウト」）
      // oxlint-disable-next-line react/set-state-in-effect -- DOM の実測を state に戻す唯一の経路
      setSizes(next)
    }
  }, [roots, sizes, measureTick, editingId])

  useLayoutEffect(() => {
    // 文書に入ったとき（0 から大きさが付く）と、ノード編集で中身が伸びたときに測り直す
    const observer = new ResizeObserver(() => setMeasureTick((t) => t + 1))
    if (container.current) {
      observer.observe(container.current)
    }
    const editingEl = editingId ? elements.current.get(editingId) : undefined
    if (editingEl) {
      observer.observe(editingEl)
    }
    // 書体が届くと同じ中身でも大きさが変わる
    const onFonts = () => setSizes(new Map())
    document.fonts.addEventListener('loadingdone', onFonts)
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [editingId])

  const focusId = selectedId ?? hitId
  useLayoutEffect(() => {
    if (focusId) {
      elements.current.get(focusId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [focusId, measureTick])

  return (
    <div
      ref={container}
      className="relative"
      // 右端の列の「子を足す」と、最後のノードの「兄弟を足す」の印の場所を常に空けておく
      style={{ width: layout.width + LAYOUT.columnGap, height: layout.height + LAYOUT.siblingGap }}
    >
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        {layout.edges.map((edge) => {
          const parent = tweened.rect(edge.from)
          const child = tweened.rect(edge.to)
          if (!parent || !child) {
            return null
          }
          const appear = tweened.appear(edge.to)
          // 現れる子への辺は、親の側から伸ばして描く
          const drawing =
            appear < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - appear } : {}
          return (
            <path
              key={`${edge.from}>${edge.to}`}
              d={edgePath(parent, child)}
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth={1}
              strokeLinecap="round"
              {...drawing}
            />
          )
        })}
      </svg>
      {nodes.map((node) => (
        <NodeBox
          key={node.id}
          id={node.id}
          content={node.content}
          hidden={node.collapsed ? countDescendants(node) : 0}
          x={tweened.rect(node.id)?.x ?? 0}
          y={tweened.rect(node.id)?.y ?? 0}
          appear={tweened.appear(node.id)}
          selected={node.id === selectedId || node.id === hitId}
          search={search}
          editing={node.id === editingId ? editing : null}
          register={register}
          onSelectNode={onSelectNode}
          onEditNode={onEditNode}
          onCommit={onCommit}
          onHasTextChange={setEditingHasText}
        />
      ))}
      {showGuide && selectedId && selectedRect && selectedNode && (
        <>
          {selectedNode.children.length === 0 && (
            <Signifier
              key={`child:${selectedId}:${guideHidden}`}
              direction="right"
              hidden={guideHidden}
              keys="Tab"
              title="子ノードを足す（Tab）"
              x={selectedRect.x + selectedRect.width + SIGNIFIER_GAP}
              y={selectedRect.y + (selectedRect.height - SIGNIFIER_HEIGHT) / 2}
              onAdd={editing ? null : () => onAddNode(toPath(selectedId), 'child')}
            />
          )}
          <Signifier
            key={`sibling:${selectedId}:${siblingKey}:${guideHidden}`}
            direction="down"
            hidden={guideHidden}
            keys={siblingKey}
            title={`下に兄弟ノードを足す（${siblingKey}）`}
            x={selectedRect.x}
            y={selectedRect.y + selectedRect.height + (LAYOUT.siblingGap - SIGNIFIER_HEIGHT) / 2}
            centerIn={selectedRect.width}
            onAdd={editing ? null : () => onAddNode(toPath(selectedId), 'sibling')}
          />
        </>
      )}
    </div>
  )
}

interface SignifierProps {
  /** 場所は空けたまま見せない */
  hidden?: boolean
  /** 現れるときに滑ってくる向き（ノードから離れる向き） */
  direction: 'right' | 'down'
  keys: string
  title: string
  x: number
  y: number
  /** 与えると、x からこの幅の中で左右中央に置く */
  centerIn?: number
  /** null なら押せない（ノード編集中。確定はノードのエディタが持っているため） */
  onAdd: (() => void) | null
}

/**
 * ノードを足せる場所とキーを示す小さな印。押しても足せる。
 * 選択が移るたびに key を変えて作り直し、ノードから滑り出るように現す
 */
function Signifier({ hidden, direction, keys, title, x, y, centerIn, onAdd }: SignifierProps) {
  return (
    // 印がノードより広いときは右へはみ出させる（safe）。左の列の端で切れないように
    <div
      className={cn('pointer-events-none absolute flex justify-center-safe', hidden && 'invisible')}
      style={{ left: x, top: y, width: centerIn }}
    >
      <button
        type="button"
        tabIndex={-1}
        title={title}
        className={cn(
          'flex h-4.5 shrink-0 items-center rounded-sm border border-dashed border-border-strong bg-background px-1 font-mono text-2xs text-muted-foreground',
          direction === 'right'
            ? 'motion-safe:animate-nudge-in-x'
            : 'motion-safe:animate-nudge-in-y',
          onAdd && 'pointer-events-auto hover:text-foreground',
        )}
        onMouseDown={(event) => {
          // キー入力は本文のエディタ（編集中はノードのエディタ）が受け続ける
          event.preventDefault()
          onAdd?.()
        }}
      >
        +{keys}
      </button>
    </div>
  )
}

interface NodeBoxProps {
  id: string
  content: string
  /** 折りたたんで隠している子孫の数 */
  hidden: number
  x: number
  y: number
  /** 現れている途中なら 0 から 1 */
  appear: number
  selected: boolean
  search: RegExp | null
  editing: Editing | null
  register: (id: string, el: HTMLElement | null) => void
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onCommit: (text: string, next: CommitNext) => void
  onHasTextChange: (hasText: boolean) => void
}

/** ノード 1 つ。選択が動いても、関係の無いノードは描き直さない（200 ノードで 16ms に収めるため） */
function NodeBox({
  id,
  content,
  hidden,
  x,
  y,
  appear,
  selected,
  search,
  editing,
  register,
  onSelectNode,
  onEditNode,
  onCommit,
  onHasTextChange,
}: NodeBoxProps) {
  return (
    <div
      ref={(el) => register(id, el)}
      data-node-id={id}
      data-tree-node=""
      role="treeitem"
      aria-selected={selected}
      tabIndex={-1}
      className={cn(
        'absolute w-max max-w-[calc(32ch+18px)] cursor-default rounded-sm border bg-card px-2 py-1 break-words',
        selected ? 'border-selected-border bg-selected' : 'border-border',
        !content && !editing && 'min-w-8 text-muted-foreground',
      )}
      style={{ left: x, top: y, opacity: appear < 1 ? appear : undefined }}
      onMouseDown={(event) => {
        if (!editing) {
          event.preventDefault()
          onSelectNode(toPath(id))
        }
      }}
      onDoubleClick={() => onEditNode(toPath(id))}
    >
      {editing ? (
        <NodeEditor
          key={`${id}:${editing.cursor}`}
          initial={content}
          cursor={editing.cursor}
          onCommit={onCommit}
          onHasTextChange={onHasTextChange}
        />
      ) : (
        <InlineContent content={content} search={search} />
      )}
      {hidden > 0 && (
        <span className="ml-1 text-2xs text-muted-foreground" title="za で開く">
          +{hidden}
        </span>
      )}
    </div>
  )
}
