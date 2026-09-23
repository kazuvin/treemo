import type { EditorView } from '@codemirror/view'
import { KeyHints } from '@/components/ui/key-hints'
import { addNodeAt, commitEdit, editNode, selectNode } from '../extensions/tree-actions'
import { useDiagramStore } from '../stores/diagram-store'
import { KeyGuide } from './key-guide'
import { TreeCanvas } from './tree-canvas'
import { ZoomControl } from './zoom-control'

/** DIAGRAM モードの全画面表示（F-TREE-5）。エディタの上に重ね、同じ状態を見る */
export function DiagramFullscreen({ view }: { view: EditorView | null }) {
  const active = useDiagramStore((s) => s.active)
  const showGuide = useDiagramStore((s) => s.showKeyGuide)
  const zoom = useDiagramStore((s) => s.zoom)
  if (!view || !active?.fullscreen) {
    return null
  }
  return (
    <div
      role="presentation"
      data-diagram-active="true"
      className="absolute inset-0 z-10 flex flex-col bg-background outline-2 -outline-offset-2 outline-selected-border"
      onMouseDown={(event) => {
        // キー入力は本文のエディタが受け続ける
        if (!(event.target instanceof HTMLElement && event.target.closest('.cm-editor'))) {
          event.preventDefault()
        }
      }}
    >
      <div className="flex items-start gap-4 px-6 py-3">
        {showGuide && <KeyGuide editing={active.editing} />}
        <ZoomControl className="ml-auto" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-12">
        {active.roots.length > 0 ? (
          <TreeCanvas
            roots={active.roots}
            selectedId={active.path?.join('.') ?? null}
            editing={active.editing}
            showGuide={showGuide}
            zoom={zoom}
            fitAxes="both"
            onAddNode={(path, where) => addNodeAt(view, active.from, path, where)}
            onSelectNode={(path) => selectNode(view, active.from, path)}
            onEditNode={(path) => {
              selectNode(view, active.from, path)
              editNode(view, 'end')
            }}
            onCommit={(text, next) => commitEdit(view, text, next)}
          />
        ) : (
          <KeyHints hints={[{ keys: ['o'], label: 'ノードを足す' }]} />
        )}
      </div>
    </div>
  )
}
