import { type EditorView, WidgetType } from '@codemirror/view'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { type BlockStatus, TreeBlockView } from '../components/tree-block-view'
import { useTreeStore } from '../stores/tree-store'
import type { StrayLine, TreeNode } from '../types/tree'
import { addNodeAt, commitEdit, editNode, selectBlock, selectNode } from './tree-actions'
import type { Editing } from './tree-state'

export interface TreeWidgetProps {
  from: number
  source: string
  status: BlockStatus
  roots: TreeNode[]
  strayLines: StrayLine[]
  selectedId: string | null
  /** 検索などでカーソルが中身の行に来たときの、その行のノード */
  hitId: string | null
  /** Vim が光らせている検索。無ければ null */
  search: RegExp | null
  editing: Editing | null
  /** 折りたたみが変わったら描き直すための鍵 */
  foldKey: string
}

const roots = new WeakMap<HTMLElement, Root>()
const observers = new WeakMap<HTMLElement, ResizeObserver>()

function GuideAwareView({ view, props }: { view: EditorView; props: TreeWidgetProps }) {
  const showGuide = useTreeStore((s) => s.showKeyGuide)
  return (
    <TreeBlockView
      status={props.status}
      roots={props.roots}
      strayLines={props.strayLines}
      selectedId={props.selectedId}
      hitId={props.hitId}
      search={props.search}
      editing={props.editing}
      showGuide={showGuide}
      onSelectBlock={() => selectBlock(view, props.from)}
      onSelectNode={(path) => selectNode(view, props.from, path)}
      onEditNode={(path) => {
        selectNode(view, props.from, path)
        editNode(view, 'end')
      }}
      onAddNode={(path, where) => addNodeAt(view, props.from, path, where)}
      onCommit={(text, next) => commitEdit(view, text, next)}
    />
  )
}

/**
 * ツリーブロックの絵（F-TREE-1）。中に小さな React のルートを持ち、
 * 同じブロックの描き直しは updateDOM で同じルートに流す（ノード編集中のエディタを保つため）。
 */
export class TreeWidget extends WidgetType {
  constructor(readonly props: TreeWidgetProps) {
    super()
  }

  override eq(other: TreeWidget): boolean {
    const a = this.props
    const b = other.props
    return (
      a.from === b.from &&
      a.source === b.source &&
      a.status === b.status &&
      a.selectedId === b.selectedId &&
      a.hitId === b.hitId &&
      a.search === b.search &&
      a.foldKey === b.foldKey &&
      a.editing?.path.join('.') === b.editing?.path.join('.') &&
      a.editing?.cursor === b.editing?.cursor
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement('div')
    dom.className = 'cm-tree-block'
    dom.contentEditable = 'false'
    const root = createRoot(dom)
    roots.set(dom, root)
    // ノードを測って配置し直すと高さが変わる。エディタの高さの見積もりを合わせる
    const observer = new ResizeObserver(() => view.requestMeasure())
    observer.observe(dom)
    observers.set(dom, observer)
    this.render(root, view)
    return dom
  }

  override updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const root = roots.get(dom)
    if (!root) {
      return false
    }
    this.render(root, view)
    return true
  }

  override destroy(dom: HTMLElement): void {
    const root = roots.get(dom)
    roots.delete(dom)
    observers.get(dom)?.disconnect()
    observers.delete(dom)
    // CodeMirror の更新の途中で React のルートを同期的に外すと警告になるので、後で外す
    setTimeout(() => root?.unmount(), 0)
  }

  override get estimatedHeight(): number {
    return 40 + this.props.roots.length * 32
  }

  override ignoreEvent(): boolean {
    return true
  }

  private render(root: Root, view: EditorView): void {
    flushSync(() => root.render(<GuideAwareView view={view} props={this.props} />))
    view.requestMeasure()
  }
}
