import { type KeyHint, KeyHints } from '@/components/ui/key-hints'
import type { Editing } from '../extensions/tree-state'
import type { TreeDirection } from '../utils/direction'

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
  { keys: ['gr'], label: '縦横' },
  { keys: ['za'], label: '折りたたみ' },
  { keys: ['+', '-'], label: '拡大縮小' },
  { keys: ['='], label: '合わせる' },
  { keys: ['F'], label: '全画面' },
  { keys: ['Esc'], label: '出る' },
]

const NORMAL_TB = NORMAL.map((hint) =>
  hint.label === '入れ替え' ? { ...hint, keys: ['H', 'L'] } : hint,
)

/**
 * DIAGRAM モードで次に押せる主なキー（F-UX-5）。ノードの近くに出すと隣のノードと重なるので、
 * 操作中のブロックの下端に 1 行で出す。設定で消したときは何も出さない。
 */
export function KeyGuide({
  editing,
  direction,
}: {
  editing: Editing | null
  direction: TreeDirection
}) {
  if (editing) {
    return <KeyHints hints={EDITING} />
  }
  // 縦向きでは兄弟が左右に並ぶので、入れ替えは H / L
  return <KeyHints hints={direction === 'lr' ? NORMAL : NORMAL_TB} />
}
