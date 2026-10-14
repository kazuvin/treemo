/**
 * T 字の図（docs/t-chart.md）。中心の言葉から、なぜ？（下）・それで？（右）・本当に？（左）の
 * 3 本の腕を出す。テキストでは中心をルート、問いを中心の子、答えを問いの子として持つ。
 * 答えの子は、同じ問いを重ねたもの（なぜ？ → なぜ？）になる。
 */
import type { NodePath, StrayLine, TreeNode } from '../types/tree'
import { type FlowDirection, type ScreenDirection, treeMove } from './direction'

interface TArm {
  /** 書き戻すときの問いの書き方 */
  label: string
  /** 答えが伸びる向き */
  flow: FlowDirection
  /** 中心から見た腕の向き。中心でこの向きのキーを押すと、この問いへ移る */
  screen: ScreenDirection
}

/** 腕の並び。テキストにもこの順で書き戻す */
export const T_ARMS: readonly TArm[] = [
  { label: 'なぜ？', flow: 'tb', screen: 'down' },
  { label: 'それで？', flow: 'lr', screen: 'right' },
  { label: '本当に？', flow: 'rl', screen: 'left' },
]

const WORDS = ['なぜ', 'それで', '本当に']
/** `？` は半角でも、無くてもよい */
const QUESTION = /^(なぜ|それで|本当に)[？?]?$/

export const EMPTY_TCHART = [
  '```tchart',
  '-',
  ...T_ARMS.map((arm) => `  - ${arm.label}`),
  '```',
].join('\n')

/** 問いの書き方から腕の添字を返す。問いでなければ -1 */
export function armOfQuestion(content: string): number {
  const word = QUESTION.exec(content.trim())?.[1]
  return word === undefined ? -1 : WORDS.indexOf(word)
}

/**
 * 読んだノードを T 字の形（中心が 1 つ、その子に問いが決まった順で 3 つ）にそろえる。
 * 無い問いは足し、同じ問いが 2 度あれば答えを 1 つにまとめる。問いではない中心の子と、
 * 2 つ目からのルートは読めない行にする。lines はブロックの行（0 が開始フェンス）
 */
export function normalizeTChart(
  roots: readonly TreeNode[],
  lines: readonly string[],
): { roots: TreeNode[]; strayLines: StrayLine[] } {
  const strayLines: StrayLine[] = []
  const stray = (node: TreeNode) => {
    if (node.line !== undefined) {
      strayLines.push({ line: node.line, text: lines[node.line] ?? '' })
    }
    node.children.forEach(stray)
  }
  const [first, ...rest] = roots
  rest.forEach(stray)
  const center: TreeNode = first ? { ...first } : { id: '', content: '', children: [] }
  const questions: TreeNode[] = []
  for (const child of first?.children ?? []) {
    const arm = armOfQuestion(child.content)
    const label = T_ARMS[arm]?.label
    if (label === undefined) {
      stray(child)
      continue
    }
    const seen = questions[arm]
    if (seen) {
      seen.children.push(...child.children)
    } else {
      questions[arm] = { ...child, content: label, children: [...child.children] }
    }
  }
  center.children = T_ARMS.map(
    (arm, i) => questions[i] ?? { id: '', content: arm.label, children: [] },
  )
  return { roots: [center], strayLines }
}

/** 中心（ルート）、問い（中心の子）、答え（それより深いもの） */
type TPart = 'center' | 'question' | 'answer'

export function tPartOf(path: NodePath): TPart {
  if (path.length <= 1) {
    return 'center'
  }
  return path.length === 2 ? 'question' : 'answer'
}

/** 問いと答えが伸びる向き。中心は null */
export function tFlowOf(path: NodePath): FlowDirection | null {
  return path.length < 2 ? null : (T_ARMS[path[1] ?? 0]?.flow ?? null)
}

/**
 * T 字の図での h / j / k / l。中心からは押した向きの問いへ移り、腕の中ではその腕の向きの
 * ツリーとして動く。問いどうしは並んでいないので、問いの上では兄弟へは動かない
 */
export function tchartMove(
  path: NodePath,
  screen: ScreenDirection,
): 'parent' | 'child' | 'prev' | 'next' | number[] | null {
  const flow = tFlowOf(path)
  if (!flow) {
    const arm = T_ARMS.findIndex((a) => a.screen === screen)
    return arm < 0 ? null : [...path, arm]
  }
  const move = treeMove(flow, screen)
  if (tPartOf(path) === 'question' && (move === 'prev' || move === 'next')) {
    return null
  }
  return move
}

/**
 * - reshape: 兄弟を足す・字下げ・入れ替え・削除・兄弟として貼り付け
 * - grow: 子を足す・子として貼り付け
 */
type TAction = 'reshape' | 'grow' | 'edit' | 'outdent' | 'fold'

const ALLOWED: Record<TAction, readonly TPart[]> = {
  reshape: ['answer'],
  grow: ['question', 'answer'],
  edit: ['center', 'answer'],
  outdent: ['answer'],
  fold: ['question', 'answer'],
}

/** 中心と問いは T の骨組みなので、消したり動かしたりしない。問いの中身も決まっている */
export function tchartAllows(action: TAction, path: NodePath): boolean {
  // 腕の最初の段の答えを字上げすると、問いの並びに出てしまう
  if (action === 'outdent' && path.length < 4) {
    return false
  }
  return ALLOWED[action].includes(tPartOf(path))
}
