import { useEffect, useRef } from 'react'

export function useAutoResize(value: string, minRows: number = 1) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const computed = window.getComputedStyle(el)
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2
    const paddingTop = parseFloat(computed.paddingTop) || 0
    const paddingBottom = parseFloat(computed.paddingBottom) || 0
    const borderTop = parseFloat(computed.borderTopWidth) || 0
    const borderBottom = parseFloat(computed.borderBottomWidth) || 0
    const minHeight = lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom

    el.style.height = 'auto'
    const next = Math.max(el.scrollHeight, minHeight)
    el.style.height = `${next}px`
  }, [value, minRows])

  return ref
}
