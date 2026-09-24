import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TreeNode } from '../types/tree'
import type { TreeDirection } from '../utils/direction'
import type { Rect } from '../utils/layout'
import { ease, lerpPosition, matchNodes, type VisibleNode } from '../utils/motion'

const DURATION = 200
/** 現れるノードは、この距離だけ親の側（横向きなら左、縦向きなら上）から滑り込む */
const ENTER_OFFSET = 12

interface Tween {
  start: number
  /** 動き出す前に描いていた位置。無いノードは動かさずに置く */
  from: Map<string, Rect>
  /** 新しく現れたノードと、現れ始めた時刻 */
  entering: Map<string, number>
}

export interface TweenedRects {
  rect: (id: string) => Rect | undefined
  /** 現れ終えていれば 1。現れている途中なら 0 から 1 */
  appear: (id: string) => number
}

function toVisible(nodes: readonly TreeNode[]): VisibleNode[] {
  return nodes.map((node) => ({
    id: node.id,
    depth: node.id.split('.').length - 1,
    content: node.content,
  }))
}

function sameNodes(a: readonly VisibleNode[], b: readonly VisibleNode[]): boolean {
  return (
    a.length === b.length &&
    a.every((node, i) => node.id === b[i]?.id && node.content === b[i]?.content)
  )
}

function progress(start: number, now: number): number {
  return ease((now - start) / DURATION)
}

/** その時刻に描いている位置 */
function positionAt(
  tween: Tween | null,
  target: ReadonlyMap<string, Rect>,
  id: string,
  now: number,
): Rect | undefined {
  const to = target.get(id)
  const from = tween?.from.get(id)
  if (!to || !from || !tween) {
    return to
  }
  return lerpPosition(from, to, progress(tween.start, now))
}

function signatureOf(rects: ReadonlyMap<string, Rect>): string {
  return [...rects].map(([id, r]) => `${id}:${r.x},${r.y},${r.width},${r.height}`).join(';')
}

/**
 * 配置が変わったとき、前に描いていた位置から新しい位置へ滑らせる
 * （docs/tree-block.md の「動き」）。最初に描くときと、動きを減らす設定のときは動かさない
 */
export function useTweenedRects(
  nodes: readonly TreeNode[],
  target: ReadonlyMap<string, Rect>,
  direction: TreeDirection = 'lr',
): TweenedRects {
  const [tween, setTween] = useState<Tween | null>(null)
  const [now, setNow] = useState(0)
  const prev = useRef<{
    nodes: VisibleNode[]
    signature: string
    target: ReadonlyMap<string, Rect>
  } | null>(null)
  const signature = signatureOf(target)

  const rect = (id: string) => positionAt(tween, target, id, now)
  const appear = (id: string) => {
    const since = tween?.entering.get(id)
    return since === undefined ? 1 : progress(since, now)
  }

  useLayoutEffect(() => {
    const visible = toVisible(nodes)
    const last = prev.current
    prev.current = { nodes: visible, signature, target }
    if (!last || last.signature === signature) {
      return
    }
    const start = performance.now()
    const running = tween !== null && start - tween.start < DURATION
    // 同じノードの大きさが測り直されただけなら動かさない（開いた直後の実測や、ノード編集で伸びるとき）。
    // 動いている途中なら、行き先だけを差し替える
    const reshaped = !running && sameNodes(last.nodes, visible)
    if (reshaped || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // oxlint-disable-next-line react/set-state-in-effect -- 描いた位置を読んでから動きを決める
      setTween(null)
      return
    }
    const map = matchNodes(last.nodes, visible)
    const from = new Map<string, Rect>()
    const entering = new Map<string, number>()
    for (const node of visible) {
      const old = map.get(node.id)
      const was = old === undefined ? undefined : positionAt(tween, last.target, old, start)
      const to = target.get(node.id)
      if (was) {
        from.set(node.id, was)
      } else if (to) {
        from.set(
          node.id,
          direction === 'lr'
            ? { ...to, x: to.x - ENTER_OFFSET }
            : { ...to, y: to.y - ENTER_OFFSET },
        )
      }
      // 現れている途中で配置し直しても、現れ始めた時刻は引き継ぐ
      const since = old === undefined ? start : tween?.entering.get(old)
      if (since !== undefined && start - since < DURATION) {
        entering.set(node.id, since)
      }
    }
    setTween({ start, from, entering })
    setNow(start)
  }, [nodes, signature, target, tween, direction])

  useEffect(() => {
    if (!tween) {
      return
    }
    let frame = 0
    const tick = (t: number) => {
      setNow(t)
      if (t - tween.start < DURATION) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [tween])

  return { rect, appear }
}
