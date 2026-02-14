'use client'

import { useState, useRef, useEffect } from 'react'

interface QuickActionsFABProps {
    onAction: (actionId: string) => void
    activeAgent?: string | null
}

export default function QuickActionsFAB({ onAction, activeAgent }: QuickActionsFABProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const actions = [
        { id: 'ask-yoda', label: 'Ask Yoda', icon: '🧠' },
        { id: 'solution-advisor', label: 'Solution Advisor', icon: '💡' },
        { id: 'spec-assistant', label: 'Spec Assistant', icon: '📄' },
        { id: 'code-advisor', label: 'Code Advisor', icon: '🛡️' },
        { id: 'test-case-generator', label: 'Test Cases', icon: '🧪' },
        { id: 'prompt-generator', label: 'Prompt Gen', icon: '⚡' },
        { id: 'explain-code', label: 'Explain Code', icon: '💻' },
        { id: 'document-upload', label: 'Upload Docs', icon: '📤' },
    ]

    return (
        <div ref={menuRef} className="fab-wrapper">
            {/* Menu Items */}
            <div className={`fab-menu ${isOpen ? 'fab-menu-open' : 'fab-menu-closed'}`}>
                {actions.map((action, index) => (
                    <button
                        key={action.id}
                        onClick={() => { onAction(action.id); setIsOpen(false) }}
                        style={{ transitionDelay: `${index * 30}ms` }}
                        className="fab-action-item"
                    >
                        <span className="fab-action-label">{action.label}</span>
                        <div className="fab-action-icon">
                            <span>{action.icon}</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Main FAB Button - Grid icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fab-main-btn ${isOpen ? 'fab-main-btn-active' : ''}`}
                title="Quick Actions"
            >
                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                )}
            </button>
        </div>
    )
}
