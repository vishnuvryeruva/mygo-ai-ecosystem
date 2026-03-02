'use client'

import { useState, useRef, useEffect } from 'react'

interface QuickActionsFABProps {
    onAction: (actionId: string) => void
    activeAgent?: string | null
}

// SVG icon components for the FAB menu
const fabIcons: Record<string, React.ReactNode> = {
    'ask-yoda': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
    ),
    'solution-advisor': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
        </svg>
    ),
    'spec-assistant': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    'code-advisor': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
    ),
    'test-case-generator': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2v6l-2 8h10l-2-8V2" /><path d="M7 16h10" /><path d="M8 2h8" /><circle cx="12" cy="19" r="2" />
        </svg>
    ),
    'prompt-generator': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    'explain-code': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" />
        </svg>
    ),
    'document-upload': (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    ),
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
        { id: 'ask-yoda', label: 'Ask Yoda' },
        { id: 'solution-advisor', label: 'Solution Advisor' },
        { id: 'spec-assistant', label: 'Spec Agent' },
        { id: 'code-advisor', label: 'Code Advisor' },
        { id: 'test-case-generator', label: 'Test Cases' },
        { id: 'prompt-generator', label: 'Prompt Gen' },
        { id: 'explain-code', label: 'Explain Code' },
        { id: 'document-upload', label: 'Upload Docs' },
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
                            {fabIcons[action.id]}
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
