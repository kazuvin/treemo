import { type KeyHint, KeyHints } from '@/components/ui/key-hints'
import type { Editing } from '../extensions/tree-state'
import type { DiagramKind } from '../types/tree'
import type { TreeDirection } from '../utils/direction'
import { tPartOf } from '../utils/t-chart'

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

/** T 字の図。腕の向きは決まっているので縦横は無く、入れ替えのキーは腕ごとに違うので出さない */
const TCHART_NORMAL: KeyHint[] = [
  { keys: ['hjkl'], label: '移動' },
  { keys: ['Tab'], label: '答えを足す' },
  { keys: ['o'], label: '並べる' },
  { keys: ['i'], label: '編集' },
  { keys: ['dd'], label: '削除' },
  { keys: ['>', '<'], label: '字下げ' },
  { keys: ['za'], label: '折りたたみ' },
  { keys: ['+', '-'], label: '拡大縮小' },
  { keys: ['='], label: '合わせる' },
  { keys: ['F'], label: '全画面' },
  { keys: ['Esc'], label: '出る' },
]

const TCHART_EDITING: KeyHint[] = [
  { keys: ['Enter'], label: '次の答え' },
  { keys: ['Tab'], label: 'さらに問う' },
  { keys: ['⇧Enter'], label: '改行' },
  { keys: ['Esc'], label: '確定' },
]

/** 中心には兄弟も子も足さない */
const TCHART_EDITING_CENTER: KeyHint[] = [
  { keys: ['⇧Enter'], label: '改行' },
  { keys: ['Esc', 'Enter'], label: '確定' },
]

function hintsFor(editing: Editing | null, kind: DiagramKind, direction: TreeDirection): KeyHint[] {
  if (kind === 'tchart') {
    if (!editing) {
      return TCHART_NORMAL
    }
    return tPartOf(editing.path) === 'center' ? TCHART_EDITING_CENTER : TCHART_EDITING
  }
  if (editing) {
    return EDITING
  }
  // 縦向きでは兄弟が左右に並ぶので、入れ替えは H / L
  return direction === 'lr' ? NORMAL : NORMAL_TB
}

/**
 * DIAGRAM モードで次に押せる主なキー（F-UX-5）。ノードの近くに出すと隣のノードと重なるので、
 * 操作中のブロックの下端に 1 行で出す。設定で消したときは何も出さない。
 */
export function KeyGuide({
  editing,
  kind,
  direction,
}: {
  editing: Editing | null
  kind: DiagramKind
  direction: TreeDirection
}) {
  return <KeyHints hints={hintsFor(editing, kind, direction)} />
}
