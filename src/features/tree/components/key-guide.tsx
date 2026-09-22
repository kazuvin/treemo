import type { Editing } from '../extensions/tree-state'

/**
 * TREE モードで次に押せる主なキー（F-UX-5）。ノードの近くに出すと隣のノードと重なるので、
 * 操作中のブロックの下端に 1 行で出す。設定で消すと最小限だけにする。
 */
export function KeyGuide({ editing, show }: { editing: Editing | null; show: boolean }) {
  let text = 'TREE · Esc 出る'
  if (show && editing) {
    text = 'Enter 次の兄弟 · Tab 子 · ⇧Enter 改行 · Esc Esc 確定'
  } else if (show) {
    text =
      'hjkl 移動 · o 兄弟 · Tab 子 · i 編集 · dd 削除 · > < 字下げ · J K 入れ替え · za 折りたたみ · F 全画面 · Esc 出る'
  }
  return <p className="text-2xs text-muted-foreground">{text}</p>
}
