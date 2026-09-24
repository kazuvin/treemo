import { Code } from '@/components/ui/code'
import { type KeyHint, KeyHints } from '@/components/ui/key-hints'
import { cn } from '@/lib/cn'
import type { Editing } from '../extensions/tree-state'
import type { StrayLine, TreeNode } from '../types/tree'
import type { TreeDirection } from '../utils/direction'
import type { Zoom } from '../utils/zoom'
import { KeyGuide } from './key-guide'
import type { CommitNext } from './node-editor'
import { TreeCanvas } from './tree-canvas'
import { ZoomControl } from './zoom-control'

/**
 * ブロックの 4 つの状態（F-TREE-2）のうち、絵で見せる 3 つ。
 * ソース表示はウィジェットを外して生のテキストを見せるので、ここには来ない。
 */
export type BlockStatus = 'idle' | 'selected' | 'diagram' | 'fullscreen'

const SELECTED_HINTS: KeyHint[] = [
  { keys: ['Enter'], label: 'DIAGRAM モード' },
  { keys: ['gs'], label: 'ソース' },
  { keys: ['gr'], label: '縦横' },
  { keys: ['j', 'k'], label: '前後の行へ' },
]

const EMPTY_HINTS: KeyHint[] = [
  { keys: ['Enter'], label: 'DIAGRAM モードに入る' },
  { keys: ['o'], label: 'ノードを足す' },
]

interface TreeBlockViewProps {
  status: BlockStatus
  roots: TreeNode[]
  strayLines: StrayLine[]
  selectedId: string | null
  hitId: string | null
  search: RegExp | null
  editing: Editing | null
  direction: TreeDirection
  showGuide: boolean
  zoom: Zoom
  onSelectBlock: () => void
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onAddNode: (path: number[], where: 'child' | 'sibling') => void
  onCommit: (text: string, next: CommitNext) => void
}

export function TreeBlockView({
  status,
  roots,
  strayLines,
  selectedId,
  hitId,
  search,
  editing,
  direction,
  showGuide,
  zoom,
  onSelectBlock,
  onSelectNode,
  onEditNode,
  onAddNode,
  onCommit,
}: TreeBlockViewProps) {
  return (
    <div
      role="presentation"
      data-diagram-active={status === 'diagram'}
      data-cursor-blink={status === 'selected' || undefined}
      className={cn(
        'my-2 rounded-card border px-4 py-3',
        // 枠はブロックに乗っているときと DIAGRAM モードのときだけ見せる。場所は常に取っておき、
        // 枠が出入りしても本文が動かないようにする
        status === 'selected' && 'border-gray-900',
        status === 'diagram' && 'border-selected-border',
        (status === 'idle' || status === 'fullscreen') && 'border-transparent',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
          onSelectBlock()
        }
      }}
    >
      {status === 'fullscreen' ? (
        <KeyHints hints={[{ keys: ['F'], label: '全画面で編集しています。インラインに戻す' }]} />
      ) : (
        <>
          <div className="overflow-x-auto">
            {roots.length > 0 ? (
              <TreeCanvas
                roots={roots}
                selectedId={status === 'diagram' ? selectedId : null}
                hitId={status === 'selected' ? hitId : null}
                search={search}
                editing={status === 'diagram' ? editing : null}
                direction={direction}
                showGuide={showGuide}
                zoom={zoom}
                onSelectNode={onSelectNode}
                onEditNode={onEditNode}
                onAddNode={onAddNode}
                onCommit={onCommit}
              />
            ) : (
              <KeyHints hints={EMPTY_HINTS} />
            )}
          </div>
          {strayLines.length > 0 && (
            <div className="mt-2 border-t border-border-hairline pt-2 text-2xs text-subtle-foreground">
              <p>
                読めない行が {strayLines.length} 行あります。<Code>gs</Code>
                でソースを表示して直してください。直すまで DIAGRAM モードには入れません。
              </p>
              <ul className="mt-1 text-muted-foreground">
                {strayLines.slice(0, 3).map((stray) => (
                  <li key={stray.line}>
                    {stray.line + 1} 行目: <Code>{stray.text.trim()}</Code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status === 'selected' && <KeyHints className="mt-2" hints={SELECTED_HINTS} />}
          {status === 'diagram' && (
            <div className="mt-2 flex items-start gap-4">
              {showGuide && <KeyGuide editing={editing} direction={direction} />}
              <ZoomControl className="ml-auto" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
