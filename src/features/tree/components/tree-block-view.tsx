import { cn } from '@/lib/cn'
import type { Editing } from '../extensions/tree-state'
import type { StrayLine, TreeNode } from '../types/tree'
import { KeyGuide } from './key-guide'
import type { CommitNext } from './node-editor'
import { TreeCanvas } from './tree-canvas'

/**
 * ブロックの 4 つの状態（F-TREE-2）のうち、絵で見せる 3 つ。
 * ソース表示はウィジェットを外して生のテキストを見せるので、ここには来ない。
 */
export type BlockStatus = 'idle' | 'selected' | 'tree' | 'fullscreen'

interface TreeBlockViewProps {
  status: BlockStatus
  roots: TreeNode[]
  strayLines: StrayLine[]
  selectedId: string | null
  editing: Editing | null
  showGuide: boolean
  onSelectBlock: () => void
  onSelectNode: (path: number[]) => void
  onEditNode: (path: number[]) => void
  onCommit: (text: string, next: CommitNext) => void
}

export function TreeBlockView({
  status,
  roots,
  strayLines,
  selectedId,
  editing,
  showGuide,
  onSelectBlock,
  onSelectNode,
  onEditNode,
  onCommit,
}: TreeBlockViewProps) {
  return (
    <div
      role="presentation"
      data-tree-active={status === 'tree'}
      className={cn(
        'my-2 rounded-card border px-4 py-3',
        status === 'idle' && 'border-border-hairline',
        status === 'selected' && 'border-border-strong',
        status === 'tree' && 'border-selected-border',
        status === 'fullscreen' && 'border-border-hairline',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
          onSelectBlock()
        }
      }}
    >
      {status === 'fullscreen' ? (
        <p className="text-sm text-muted-foreground">全画面で編集しています · F で戻る</p>
      ) : (
        <>
          <div className="overflow-x-auto pb-5">
            {roots.length > 0 ? (
              <TreeCanvas
                roots={roots}
                selectedId={status === 'tree' ? selectedId : null}
                editing={status === 'tree' ? editing : null}
                onSelectNode={onSelectNode}
                onEditNode={onEditNode}
                onCommit={onCommit}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                空のツリー · Enter で TREE モードに入り、o でノードを足す
              </p>
            )}
          </div>
          {strayLines.length > 0 && (
            <div className="mt-2 border-t border-border-hairline pt-2 text-xs text-subtle-foreground">
              <p>
                読めない行が {strayLines.length} 行あります。gs でソースを表示して直してください。
                直すまで TREE モードには入れません。
              </p>
              <ul className="mt-1 text-muted-foreground">
                {strayLines.slice(0, 3).map((stray) => (
                  <li key={stray.line}>
                    {stray.line + 1} 行目: <code>{stray.text.trim()}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status === 'selected' && (
            <p className="mt-1 text-2xs text-muted-foreground">
              Enter TREE モード · gs ソース · j / k 前後の行へ
            </p>
          )}
          {status === 'tree' && (
            <div className="mt-1">
              <KeyGuide editing={editing} show={showGuide} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
