import type { EditorView } from '@codemirror/view'
import { KeyHints } from '@/components/ui/key-hints'
import { addNodeAt, commitEdit, editNode, selectNode } from '../extensions/tree-actions'
import { useTreeStore } from '../stores/tree-store'
import { KeyGuide } from './key-guide'
import { TreeCanvas } from './tree-canvas'

/** TREE モードの全画面表示（F-TREE-5）。エディタの上に重ね、同じ状態を見る */
export function TreeFullscreen({ view }: { view: EditorView | null }) {
  const active = useTreeStore((s) => s.active)
  const showGuide = useTreeStore((s) => s.showKeyGuide)
  if (!view || !active?.fullscreen) {
    return null
  }
  return (
    <div
      role="presentation"
      data-tree-active="true"
      className="absolute inset-0 z-10 flex flex-col bg-background outline-2 -outline-offset-2 outline-selected-border"
      onMouseDown={(event) => {
        // キー入力は本文のエディタが受け続ける
        if (!(event.target instanceof HTMLElement && event.target.closest('.cm-editor'))) {
          event.preventDefault()
        }
      }}
    >
      <div className="px-6 py-3">
        <KeyGuide editing={active.editing} show={showGuide} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-12">
        {active.roots.length > 0 ? (
          <TreeCanvas
            roots={active.roots}
            selectedId={active.path?.join('.') ?? null}
            editing={active.editing}
            showGuide={showGuide}
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
