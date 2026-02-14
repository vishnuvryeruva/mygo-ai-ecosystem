'use client'

import { useState, useRef, useEffect } from 'react'

interface AIAgentsDropdownProps {
    onAgentSelect: (agentId: string) => void
}

const agents = [
    {
        id: 'ask-yoda',
        title: 'Ask Yoda',
        description: 'Ask Yoda your questions, you shall',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
        ),
    },
    {
        id: 'sync-documents',
        title: 'Sync Documents',
        description: 'Sync documents from all sources',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
        ),
    },
    {
        id: 'solution-advisor',
        title: 'Solution Advisor',
        description: 'Get AI-powered solution recommendations',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
        ),
    },
    {
        id: 'spec-assistant',
        title: 'Spec Agent',
        description: 'Auto-generate specifications',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
        ),
    },
    {
        id: 'prompt-generator',
        title: 'Prompt Generator',
        description: 'Generate prompts for your workflows',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
    },
    {
        id: 'test-case-generator',
        title: 'Generate Test Case',
        description: 'Generate test cases from documents',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2632a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
        ),
    },
]

export default function AIAgentsDropdown({ onAgentSelect }: AIAgentsDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    return (
        <div ref={dropdownRef} className="ai-agents-dropdown-wrapper">
            <button
                className="ai-agents-btn"
                onClick={() => setIsOpen(!isOpen)}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                </svg>
                <span>AI Agents</span>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div className="ai-agents-dropdown">
                    {agents.map((agent) => (
                        <button
                            key={agent.id}
                            className="ai-agents-dropdown-item"
                            onClick={() => {
                                onAgentSelect(agent.id)
                                setIsOpen(false)
                            }}
                        >
                            <div className="ai-agents-dropdown-icon">{agent.icon}</div>
                            <div className="ai-agents-dropdown-info">
                                <div className="ai-agents-dropdown-title">{agent.title}</div>
                                <div className="ai-agents-dropdown-desc">{agent.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
