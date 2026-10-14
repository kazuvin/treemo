import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Editing } from '../extensions/tree-state'
import { useTweenedRects } from '../hooks/use-tweened-rects'
import { useDiagramStore } from '../stores/diagram-store'
import type { DiagramKind, TreeNode } from '../types/tree'
import type { FlowDirection, TreeDirection } from '../utils/direction'
import {
  edgePath,
  layoutTChart,
  layoutTree,
  type Rect,
  type Size,
  type TChartLayoutOptions,
} from '../utils/layout'
import { getNode } from '../utils/ops'
import { T_ARMS, tFlowOf, tPartOf } from '../utils/t-chart'
import { fitZoom, type Zoom } from '../utils/zoom'
import { InlineContent } from './inline-content'
import { type CommitNext, NodeEditor } from './node-editor'

/**
 * 深さの段のあいだは辺の折れ目と「子を足す」の印、兄弟のあいだは「兄弟を足す」の印が入る幅。
 * 印はこの隙間に重ねて出すので、出し入れしてもノードは動かない。縦向きでは「兄弟を足す」の印が
 * 兄弟の横に並ぶので、兄弟のあいだを印の幅（`+Enter`）ぶん広げる
 */
const LAYOUTS = {
  lr: { columnGap: 48, siblingGap: 24 },
  tb: { columnGap: 48, siblingGap: 56 },
} as const
/**
 * T 字の図は、横の腕を左から右、下の腕を上から下のツリーと同じ間隔で組む。
 * 左右と下の余白は、腕の先に出す印（`+Enter` がいちばん広い）が入る幅
 */
const T_LAYOUT: TChartLayoutOptions = {
  stemGap: 24,
  side: LAYOUTS.lr,
  down: LAYOUTS.tb,
  armGap: LAYOUTS.tb.columnGap,
  margin: LAYOUTS.tb.siblingGap,
}
/** 印の高さ（text-2xs の行 16px + 枠）。兄弟のあいだの縦の中央に置く */
const SIGNIFIER_HEIGHT = 18
const SIGNIFIER_GAP = 4
/** ノードの左に出す印の置き場所の幅（深さの段のあいだに収める） */
const SIGNIFIER_LEFT_ROOM = LAYOUTS.lr.columnGap - SIGNIFIER_GAP
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
  /** 選んでいるノードの ID。DIAGRAM モードでなければ null */
  selectedId: string | null
  /** 検索で当たったノードの ID。ブロックを選んでいるだけのとき（DIAGRAM モードの外）に示す */
  hitId?: string | null
  /** 中身の中で光らせる検索 */
  search?: RegExp | null
  editing: Editing | null
  /** 選んでいるノードの横と下に、ノードを足す印を出すか */
  showGuide: boolean
  /** 図の倍率。ノードの大きさは倍率を掛ける前の値で測り、配置する */
  zoom?: Zoom
  /** 'fit' のとき、親の箱のどちらの向きに収めるか */
  fitAxes?: 'width' | 'both'
  kind?: DiagramKind
  direction?: TreeDirection
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
  zoom = 1,
  fitAxes = 'width',
  kind = 'tree',
  direction = 'lr',
  onSelectNode,
  onEditNode,
  onAddNode,
  onCommit,
}: TreeCanvasProps) {
  // 大きさは中身だけで決まるので、中身をキーに覚える。操作でノードの ID がずれても測り直さずに済む
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(new Map())
  const [measureTick, setMeasureTick] = useState(0)
  // 空のまま Enter を押すとノードは消えて DIAGRAM (NORMAL) に戻り、Tab は何もしないので、
  // そのときは +Enter と +Tab を出さない
  const [editingHasText, setEditingHasText] = useState(false)
  const elements = useRef(new Map<string, HTMLElement>())
  const container = useRef<HTMLDivElement>(null)
  const outer = useRef<HTMLDivElement>(null)
  // 'fit' のときに図を収める場所（親の箱の中身の大きさ）。大きさが変わるたびに測り直す
  const [room, setRoom] = useState<Size | null>(null)
  const editingId = editing?.path.join('.') ?? null
  const sizeKey = (node: TreeNode) => (node.id === editingId ? EDITING_KEY : node.content)

  const register = (id: string, el: HTMLElement | null) => {
    if (el) {
      elements.current.set(id, el)
    } else {
      elements.current.delete(id)
    }
  }

  const gaps = LAYOUTS[direction]
  const sizeOf = (node: TreeNode) => sizes.get(sizeKey(node)) ?? estimate(node)
  const layout =
    kind === 'tchart'
      ? layoutTChart(roots, sizeOf, T_LAYOUT)
      : layoutTree(roots, sizeOf, { ...gaps, direction })
  const nodes = visibleNodes(roots)
  const tweened = useTweenedRects(nodes, layout.rects, kind, direction)
  const selectedRect = selectedId ? tweened.rect(selectedId) : undefined
  // DIAGRAM (INSERT) では Enter が下の兄弟、Tab が子（docs/keybindings.md の「ノード編集」）
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
    // 文字の大きさと書体の設定は <html> の変数（--font-scale など）に書かれる。中身をキーにした
    // 大きさは古くなるので覚え直す。色の変数でも走るが、測り直すだけで害は無い
    const rootStyle = new MutationObserver(onFonts)
    rootStyle.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => {
      observer.disconnect()
      rootStyle.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [editingId])

  const fitting = zoom === 'fit'
  useLayoutEffect(() => {
    const parent = outer.current?.parentElement
    if (!fitting || !parent) {
      return
    }
    const measure = () => {
      const style = getComputedStyle(parent)
      const px = (value: string) => Number.parseFloat(value) || 0
      setRoom({
        width: parent.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
        height: parent.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [fitting])

  // 最後の段の「子を足す」と、最後のノードの「兄弟を足す」の印の場所を常に空けておく。
  // T 字の図の配置は、この余白も含めて返す
  let width = layout.width
  let height = layout.height
  if (kind === 'tree') {
    width += direction === 'lr' ? gaps.columnGap : gaps.siblingGap
    height += direction === 'lr' ? gaps.siblingGap : gaps.columnGap
  }
  const scale = fitting
    ? fitZoom({ width, height }, room ?? { width: 0, height: 0 }, fitAxes)
    : zoom

  const active = selectedId !== null
  useEffect(() => {
    if (active && fitting) {
      useDiagramStore.getState().setFitScale(scale)
    }
  }, [active, fitting, scale])

  const focusId = selectedId ?? hitId
  useLayoutEffect(() => {
    if (focusId) {
      elements.current.get(focusId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [focusId, measureTick, scale])

  return (
    // transform は周りの配置に効かないので、外側の箱で倍率を掛けた後の場所を取る
    <div ref={outer} style={{ width: width * scale, height: height * scale }}>
      <div
        ref={container}
        className="relative origin-top-left"
        style={{ width, height, transform: scale === 1 ? undefined : `scale(${scale})` }}
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
                d={edgePath(parent, child, edge.flow)}
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
            variant={kind === 'tchart' ? tPartOf(toPath(node.id)) : 'node'}
            selected={node.id === selectedId || node.id === hitId}
            cursor={node.id === selectedId}
            search={search}
            editing={node.id === editingId ? editing : null}
            register={register}
            onSelectNode={onSelectNode}
            onEditNode={onEditNode}
            onCommit={onCommit}
            onHasTextChange={setEditingHasText}
          />
        ))}
        {showGuide &&
          selectedId &&
          selectedRect &&
          selectedNode &&
          signifiersFor(kind, direction, toPath(selectedId), selectedNode, siblingKey).map(
            (spec) => (
              <Signifier
                key={`${spec.where}:${selectedId}:${spec.where === 'sibling' ? siblingKey : ''}:${guideHidden}`}
                side={spec.side}
                hidden={guideHidden}
                keys={spec.where === 'child' ? 'Tab' : siblingKey}
                title={spec.title}
                {...placeSignifier(selectedRect, spec)}
                onAdd={editing ? null : () => onAddNode(toPath(selectedId), spec.where)}
              />
            ),
          )}
      </div>
    </div>
  )
}

/** 印を出す場所。ノードの右・左（T 字の図の左の腕）・下 */
type SignifierSide = 'right' | 'left' | 'below'

interface SignifierSpec {
  where: 'child' | 'sibling'
  side: SignifierSide
  /** below のとき、印を置く隙間の高さ */
  gap: number
  title: string
}

const SIDE_OF_FLOW: Record<FlowDirection, SignifierSide> = {
  lr: 'right',
  rl: 'left',
  tb: 'below',
}

/**
 * 選んでいるノードに出す印。子の印は子が無いときだけ出す。T 字の図の中心には出さず、
 * 問いには子（答え）の印だけを出す。印は腕の向きに出る
 */
function signifiersFor(
  kind: DiagramKind,
  direction: TreeDirection,
  path: number[],
  node: TreeNode,
  siblingKey: string,
): SignifierSpec[] {
  const out: SignifierSpec[] = []
  const flow = kind === 'tchart' ? tFlowOf(path) : direction
  if (!flow) {
    return out
  }
  const across = flow === 'tb' ? 'right' : 'below'
  const label = T_ARMS[path[1] ?? 0]?.label ?? ''
  const question = kind === 'tchart' && tPartOf(path) === 'question'
  if (node.children.length === 0) {
    let title = '子ノードを足す（Tab）'
    if (kind === 'tchart') {
      title = question ? `${label}の答えを足す（Tab）` : `さらに${label}と問う（Tab）`
    }
    out.push({ where: 'child', side: SIDE_OF_FLOW[flow], gap: LAYOUTS.tb.columnGap, title })
  }
  if (!question) {
    const title =
      kind === 'tchart'
        ? `${label}の答えを並べる（${siblingKey}）`
        : `${across === 'below' ? '下' : '右'}に兄弟ノードを足す（${siblingKey}）`
    out.push({ where: 'sibling', side: across, gap: LAYOUTS.lr.siblingGap, title })
  }
  return out
}

interface SignifierPlace {
  x: number
  y: number
  /** 与えると、x からこの幅の中で align のとおりに置く */
  width?: number
  align?: 'center' | 'end'
}

/**
 * 印の場所。子の印は深さの段のあいだ、兄弟の印は兄弟のあいだに置き、ノードの辺の中央にそろえる
 */
function placeSignifier(rect: Rect, spec: SignifierSpec): SignifierPlace {
  const middle = rect.y + (rect.height - SIGNIFIER_HEIGHT) / 2
  switch (spec.side) {
    case 'right':
      return { x: rect.x + rect.width + SIGNIFIER_GAP, y: middle }
    case 'left':
      return {
        x: rect.x - SIGNIFIER_GAP - SIGNIFIER_LEFT_ROOM,
        y: middle,
        width: SIGNIFIER_LEFT_ROOM,
        align: 'end',
      }
    case 'below':
      return {
        x: rect.x,
        y: rect.y + rect.height + (spec.gap - SIGNIFIER_HEIGHT) / 2,
        width: rect.width,
        align: 'center',
      }
    default:
      return { x: rect.x, y: rect.y }
  }
}

const NUDGE: Record<SignifierSide, string> = {
  right: 'motion-safe:animate-nudge-in-x',
  left: 'motion-safe:animate-nudge-in-x-reverse',
  below: 'motion-safe:animate-nudge-in-y',
}

interface SignifierProps extends SignifierPlace {
  /** 場所は空けたまま見せない */
  hidden?: boolean
  /** 現れるときは、この向き（ノードから離れる向き）へ滑ってくる */
  side: SignifierSide
  keys: string
  title: string
  /** null なら押せない（ノード編集中。確定はノードのエディタが持っているため） */
  onAdd: (() => void) | null
}

/**
 * ノードを足せる場所とキーを示す小さな印。押しても足せる。
 * 選択が移るたびに key を変えて作り直し、ノードから滑り出るように現す
 */
function Signifier({ hidden, side, keys, title, x, y, width, align, onAdd }: SignifierProps) {
  return (
    // 中央にそろえる印がノードより広いときは右へはみ出させる（safe）。左の列の端で切れないように。
    // 左に出す印は、ノードに重ならないよう左へはみ出させる
    <div
      className={cn(
        'pointer-events-none absolute flex',
        align === 'end' ? 'justify-end' : 'justify-center-safe',
        hidden && 'invisible',
      )}
      style={{ left: x, top: y, width }}
    >
      <button
        type="button"
        tabIndex={-1}
        title={title}
        className={cn(
          'flex h-4.5 shrink-0 items-center rounded-sm border border-dashed border-border-strong bg-background px-1 font-mono text-2xs text-muted-foreground',
          NUDGE[side],
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

const BORDER: Record<NodeBoxProps['variant'], string> = {
  node: 'border-border',
  answer: 'border-border',
  center: 'border-border-strong',
  question: 'border-transparent',
}

interface NodeBoxProps {
  id: string
  content: string
  /** T 字の図の中心と問いは見た目を変える。問いはタグと同じチップの形 */
  variant: 'node' | 'center' | 'question' | 'answer'
  /** 折りたたんで隠している子孫の数 */
  hidden: number
  x: number
  y: number
  /** 現れている途中なら 0 から 1 */
  appear: number
  selected: boolean
  /** DIAGRAM モードのカーソル。本文の Vim のカーソルと同じ色の枠で示し、NORMAL では点滅させる */
  cursor: boolean
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
  variant,
  hidden,
  x,
  y,
  appear,
  selected,
  cursor,
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
      data-cursor-blink={(cursor && !editing) || undefined}
      tabIndex={-1}
      className={cn(
        'absolute w-max max-w-[calc(32ch+18px)] cursor-default rounded-sm border bg-card px-2 py-1 break-words',
        variant === 'center' && 'font-medium',
        variant === 'question' && 'rounded-chip bg-muted py-0 text-xs text-subtle-foreground',
        selected ? 'border-selected-border bg-selected' : BORDER[variant],
        // 本文の Vim のカーソル（.cm-fat-cursor）と同じ色
        cursor && 'border-gray-900',
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
