'use client'

import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

interface SidebarProps {
    activeItem: string
    onItemClick: (item: string) => void
}

interface NavItem {
    id: string
    label: string
    icon: string
    section: 'main' | 'tools' | 'data' | 'settings'
}

const navItems: NavItem[] = [
    // Main
    { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'main' },

    // AI Tools
    { id: 'ask-yoda', label: 'Ask Yoda', icon: '🧠', section: 'tools' },
    { id: 'solution-advisor', label: 'Solution Advisor', icon: '💡', section: 'tools' },
    { id: 'spec-assistant', label: 'Spec Assistant', icon: '📄', section: 'tools' },
    { id: 'prompt-generator', label: 'Prompt Generator', icon: '⚡', section: 'tools' },
    { id: 'test-case-generator', label: 'Test Cases', icon: '🧪', section: 'tools' },
    { id: 'explain-code', label: 'Explain Code', icon: '💻', section: 'tools' },
    { id: 'code-advisor', label: 'Code Advisor', icon: '🛡️', section: 'tools' },

    // Data Management
    { id: 'sources', label: 'Sources', icon: '🔌', section: 'data' },
    { id: 'documents', label: 'Documents', icon: '📁', section: 'data' },

    // Settings
    { id: 'settings', label: 'Settings', icon: '⚙️', section: 'settings' },
]

export default function Sidebar({ activeItem, onItemClick }: SidebarProps) {
    const { theme, toggleTheme } = useTheme()
    const [isCollapsed, setIsCollapsed] = useState(false)

    const sections = [
        { key: 'main', title: null },
        { key: 'tools', title: 'AI Tools' },
        { key: 'data', title: 'Data' },
        { key: 'settings', title: 'Settings' },
    ]

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent tracking-tight">
                    YODA
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto">
                {sections.map((section) => {
                    const sectionItems = navItems.filter(item => item.section === section.key)
                    if (sectionItems.length === 0) return null

                    return (
                        <div key={section.key} className="nav-section">
                            {section.title && (
                                <div className="nav-section-title">{section.title}</div>
                            )}
                            {sectionItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`nav-item ${activeItem === item.id ? 'active' : ''}`}
                                    onClick={() => onItemClick(item.id)}
                                >
                                    <span className="nav-item-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )
                })}
            </nav>

            {/* User Profile / Footer */}
            <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                <div className="nav-item justify-between" onClick={toggleTheme}>
                    <div className="flex items-center gap-3">
                        <span className="nav-item-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                        <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-indigo-500/50' : 'bg-gray-300'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </div>

                <div className="nav-item">
                    <span className="nav-item-icon">👤</span>
                    <span>Profile</span>
                </div>
            </div>
        </aside>
    )
}
