import { type KeyHint, KeyHints } from '@/components/ui/key-hints'
import type { Editing } from '../extensions/tree-state'

const EDITING: KeyHint[] = [
  { keys: ['Enter'], label: '次の兄弟' },
  { keys: ['Tab'], label: '子' },
  { keys: ['⇧Enter'], label: '改行' },
  { keys: ['Esc'], label: '確定' },
]

const NORMAL: KeyHint[] = [
  { keys: ['hjkl'], label: '移動' },
  { keys: ['o'], label: '兄弟' },
  { keys: ['Tab'], label: '子' },
  { keys: ['i'], label: '編集' },
  { keys: ['dd'], label: '削除' },
  { keys: ['>', '<'], label: '字下げ' },
  { keys: ['J', 'K'], label: '入れ替え' },
  { keys: ['za'], label: '折りたたみ' },
  { keys: ['F'], label: '全画面' },
  { keys: ['Esc'], label: '出る' },
]

const MINIMAL: KeyHint[] = [{ keys: ['Esc'], label: 'DIAGRAM を出る' }]

/**
 * DIAGRAM モードで次に押せる主なキー（F-UX-5）。ノードの近くに出すと隣のノードと重なるので、
 * 操作中のブロックの下端に 1 行で出す。設定で消すと最小限だけにする。
 */
export function KeyGuide({ editing, show }: { editing: Editing | null; show: boolean }) {
  if (!show) {
    return <KeyHints hints={MINIMAL} />
  }
  return <KeyHints hints={editing ? EDITING : NORMAL} />
}
