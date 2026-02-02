'use client'

import { useState, useEffect, useRef } from 'react'

interface QuickActionsFABProps {
    onAction: (actionId: string) => void
}

export default function QuickActionsFAB({ onAction }: QuickActionsFABProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const actions = [
        { id: 'ask-yoda', label: 'Ask Yoda', icon: '🧠', color: 'from-purple-500 to-indigo-600' },
        { id: 'solution-advisor', label: 'Solution Advisor', icon: '💡', color: 'from-cyan-400 to-blue-500' },
        { id: 'spec-assistant', label: 'Spec Assistant', icon: '📄', color: 'from-pink-500 to-rose-500' },
        { id: 'code-advisor', label: 'Code Advisor', icon: '🛡️', color: 'from-emerald-400 to-teal-500' },
        { id: 'test-case-generator', label: 'Test Cases', icon: '🧪', color: 'from-green-400 to-emerald-500' },
        { id: 'prompt-generator', label: 'Prompt Gen', icon: '⚡', color: 'from-orange-400 to-amber-500' },
        { id: 'explain-code', label: 'Explain Code', icon: '💻', color: 'from-blue-400 to-indigo-500' },
        { id: 'document-upload', label: 'Upload Docs', icon: '📤', color: 'from-indigo-400 to-violet-500' }
    ]

    return (
        <div ref={menuRef} className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4 pointer-events-none">
            {/* Menu Items */}
            <div className={`flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                {actions.map((action, index) => (
                    <button
                        key={action.id}
                        onClick={() => { onAction(action.id); setIsOpen(false) }}
                        style={{ transitionDelay: `${index * 30}ms` }}
                        className="group flex items-center gap-3 pl-4 pr-1 py-1 rounded-full hover:scale-105 transition-transform"
                    >
                        <span className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-md backdrop-blur-sm border border-white/20 text-sm font-semibold text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                            {action.label}
                        </span>
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg shadow-black/10 group-hover:shadow-xl`}>
                            <span className="text-xl">{action.icon}</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-xl shadow-teal-500/30 hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-auto ${isOpen ? 'rotate-90' : 'rotate-0'}`}
            >
                {isOpen ? (
                    <span className="text-3xl font-light">✕</span>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                )}
            </button>
        </div>
    )
}
