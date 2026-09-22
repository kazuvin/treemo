import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Editing } from '../extensions/tree-state'
import type { TreeNode } from '../types/tree'
import { layoutTree, type Size } from '../utils/layout'
import { InlineContent } from './inline-content'
import { type CommitNext, NodeEditor } from './node-editor'

/** 列のあいだは辺の折れ目が入る幅、兄弟のあいだは 1 行の半分ほど */
const LAYOUT = { columnGap: 40, siblingGap: 8 }
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
  editing: Editing | null
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onCommit: (text: string, next: CommitNext) => void
}

function toPath(id: string): number[] {
  return id.split('.').map(Number)
}

export function TreeCanvas({
  roots,
  selectedId,
  editing,
  onSelectNode,
  onEditNode,
  onCommit,
}: TreeCanvasProps) {
  // 大きさは中身だけで決まるので、中身をキーに覚える。操作でノードの ID がずれても測り直さずに済む
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(new Map())
  const [measureTick, setMeasureTick] = useState(0)
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

  useLayoutEffect(() => {
    if (selectedId) {
      elements.current.get(selectedId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [selectedId, measureTick])

  return (
    <div
      ref={container}
      className="relative"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        {layout.edges.map((edge) => (
          <polyline
            key={`${edge.from}>${edge.to}`}
            points={edge.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth={1}
          />
        ))}
      </svg>
      {nodes.map((node) => (
        <NodeBox
          key={node.id}
          id={node.id}
          content={node.content}
          hidden={node.collapsed ? countDescendants(node) : 0}
          x={layout.rects.get(node.id)?.x ?? 0}
          y={layout.rects.get(node.id)?.y ?? 0}
          selected={node.id === selectedId}
          editing={node.id === editingId ? editing : null}
          register={register}
          onSelectNode={onSelectNode}
          onEditNode={onEditNode}
          onCommit={onCommit}
        />
      ))}
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
  selected: boolean
  editing: Editing | null
  register: (id: string, el: HTMLElement | null) => void
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onCommit: (text: string, next: CommitNext) => void
}

/** ノード 1 つ。選択が動いても、関係の無いノードは描き直さない（200 ノードで 16ms に収めるため） */
function NodeBox({
  id,
  content,
  hidden,
  x,
  y,
  selected,
  editing,
  register,
  onSelectNode,
  onEditNode,
  onCommit,
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
      style={{ left: x, top: y }}
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
        />
      ) : (
        <InlineContent content={content} />
      )}
      {hidden > 0 && (
        <span className="ml-1 text-2xs text-muted-foreground" title="za で開く">
          +{hidden}
        </span>
      )}
    </div>
  )
}
