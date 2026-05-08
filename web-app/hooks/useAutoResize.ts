import { useEffect, useRef } from 'react'

export function useAutoResize(value: string, minRows = 3, maxRows = 10) {
    const ref = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const style = getComputedStyle(el)
        const lineHeight = parseInt(style.lineHeight) || 20
        const paddingY = parseInt(style.paddingTop) + parseInt(style.paddingBottom)
        const minHeight = lineHeight * minRows + paddingY
        const maxHeight = lineHeight * maxRows + paddingY
        el.style.height = 'auto'
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
        el.style.height = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight) + 'px'
    }, [value, minRows, maxRows])

    return ref
}
