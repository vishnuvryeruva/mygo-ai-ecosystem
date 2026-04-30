'use client'

import { useEffect, useRef } from 'react'

interface AppModalProps {
  onClose: () => void
  children: React.ReactNode
  /** Optional extra class names on the dialog panel */
  className?: string
}

/**
 * Generic application modal shell.
 *
 * All seven AI-tool dialogs (Prompt & Code Studio, Solution Advisor,
 * Spec Assistant, Test Case Generator, Explain Code, Code Advisor,
 * Sync From Source) use this component so that dimensions and the
 * overall look-and-feel are controlled from a single place.
 *
 * Fixed size: 900 px wide, 85 vh tall.  Adjust the constants below
 * to change it globally.
 */

const MODAL_WIDTH = '900px'
const MODAL_MAX_HEIGHT = '85vh'

export default function AppModal({ onClose, children, className = '' }: AppModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="app-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className={`app-modal-panel ${className}`}
        style={{ width: MODAL_WIDTH, maxHeight: MODAL_MAX_HEIGHT }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
