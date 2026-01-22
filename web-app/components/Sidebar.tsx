'use client'

import { useState } from 'react'

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
                <img src="/Mygo logotype.png" alt="MYGO" />
                <h1>MYGO AI</h1>
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
            <div className="mt-auto pt-4 border-t border-white/5">
                <div className="nav-item">
                    <span className="nav-item-icon">👤</span>
                    <span>Profile</span>
                </div>
            </div>
        </aside>
    )
}
