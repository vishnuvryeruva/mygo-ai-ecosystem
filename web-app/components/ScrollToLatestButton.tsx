'use client'

interface ScrollToLatestButtonProps {
  visible: boolean
  onClick: () => void
  className?: string
}

export default function ScrollToLatestButton({
  visible,
  onClick,
  className = '',
}: ScrollToLatestButtonProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      className={`scroll-to-latest-btn ${className}`.trim()}
      onClick={onClick}
      title="Jump to latest"
      aria-label="Jump to latest messages"
    >
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M19 14l-7 7-7-7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 3v17" />
      </svg>
    </button>
  )
}
