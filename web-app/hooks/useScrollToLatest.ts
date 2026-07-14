'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SCROLL_BOTTOM_THRESHOLD = 80

/**
 * Tracks whether a scroll container is near the bottom and exposes
 * a "jump to latest" control when the user scrolls up.
 *
 * Pass `deps` (e.g. `[messages, loading]`) to auto-scroll when content
 * changes and the user is already near the bottom.
 */
export function useScrollToLatest(
  deps: unknown[],
  options?: { itemCount?: number; enabled?: boolean }
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)

  const itemCount = options?.itemCount ?? 0
  const enabled = options?.enabled ?? true
  const depsKey = JSON.stringify(deps)

  const checkNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD
  }, [])

  const handleScroll = useCallback(() => {
    if (!enabled) {
      setShowScrollToLatest(false)
      return
    }
    const nearBottom = checkNearBottom()
    isNearBottomRef.current = nearBottom
    setShowScrollToLatest(!nearBottom && itemCount > 0)
  }, [checkNearBottom, enabled, itemCount])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    isNearBottomRef.current = true
    setShowScrollToLatest(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setShowScrollToLatest(false)
      return
    }
    if (isNearBottomRef.current) {
      scrollToBottom('smooth')
    } else if (itemCount > 0) {
      setShowScrollToLatest(true)
    }
  }, [depsKey, enabled, itemCount, scrollToBottom])

  useEffect(() => {
    if (!enabled) {
      isNearBottomRef.current = true
      setShowScrollToLatest(false)
    }
  }, [enabled])

  return {
    containerRef,
    showScrollToLatest: enabled && showScrollToLatest,
    handleScroll,
    scrollToBottom,
  }
}
