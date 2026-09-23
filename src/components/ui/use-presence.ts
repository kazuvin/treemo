import { useEffect, useState } from 'react'

/** globals.css の --animate-overlay-out と同じ長さ */
const EXIT_MS = 120

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 閉じるアニメーションのあいだだけ、閉じたものを出し続ける。
 * closing の間は OverlayPanel に渡して退場させる。
 */
export function usePresence(open: boolean): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) {
    setMounted(true)
  }
  useEffect(() => {
    if (open || !mounted) {
      return
    }
    const timer = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : EXIT_MS)
    return () => clearTimeout(timer)
  }, [open, mounted])
  return { mounted: open || mounted, closing: !open && mounted }
}

/** 閉じると null になる値を、閉じるアニメーションのあいだ前の値のまま持つ */
export function useHeld<T>(value: T | null): T | null {
  const [held, setHeld] = useState(value)
  if (value !== null && value !== held) {
    setHeld(value)
  }
  return value ?? held
}
