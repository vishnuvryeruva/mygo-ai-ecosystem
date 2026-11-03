'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { usePageHeaderContext } from '@/context/PageHeaderContext'

interface TopHeaderProps {
    onSettingsClick: () => void
    onToggleSidebar?: () => void
    userName?: string
}

const routeDefaults: Record<string, { title: string; subtitle?: string; icon: React.ReactNode }> = {
    '/dashboard': {
        title: 'Dashboard',
        subtitle: 'Overview of enterprise documents, code objects, and AI agents',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
            </svg>
        ),
    },
    '/document-hub': {
        title: 'Document Hub',
        subtitle: 'Manage and explore your project documents across all sources',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
    '/code-repository': {
        title: 'Code Hub',
        subtitle: 'Manage and explore your source code and SAP repository',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        ),
    },
    '/code-hub': {
        title: 'Code Hub',
        subtitle: 'Manage and explore your source code and SAP repository',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        ),
    },
    '/sap-explorer': {
        title: 'SAP Explorer',
        subtitle: 'Direct SAP ADT REST integration and ABAP repository browsing',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
        ),
    },
    '/settings': {
        title: 'Settings',
        subtitle: 'Manage AI preferences, SAP connections, and telemetry',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
        ),
    },
}

export default function TopHeader({ onSettingsClick, onToggleSidebar, userName = 'AS' }: TopHeaderProps) {
    const pathname = usePathname()
    const { headerConfig } = usePageHeaderContext()

    const defaultMeta = routeDefaults[pathname] || {
        title: pathname ? pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Workspace',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
        )
    }

    const title = headerConfig?.title ?? defaultMeta.title
    const subtitle = headerConfig?.subtitle ?? defaultMeta.subtitle
    const icon = headerConfig?.icon ?? defaultMeta.icon
    const actions = headerConfig?.actions

    return (
        <header className="top-header">
            <div className="top-header-left">
                {onToggleSidebar && (
                    <button onClick={onToggleSidebar} className="top-header-btn mr-1" title="Toggle sidebar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                        </svg>
                    </button>
                )}

                <div className="flex items-center gap-3 animate-in fade-in duration-200">
                    {icon && (
                        <div className="w-9 h-9 rounded-xl bg-slate-100/90 border border-slate-200/80 flex items-center justify-center flex-shrink-0 text-slate-700 shadow-sm">
                            {icon}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold text-slate-800 tracking-tight leading-tight m-0">
                                {title}
                            </h1>
                        </div>
                        {subtitle && (
                            <p className="text-xs text-slate-500 m-0 leading-tight truncate max-w-md hidden md:block">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="top-header-right">
                {/* Page-Specific Action Buttons in Navbar */}
                {actions && (
                    <div className="flex items-center gap-2.5 mr-2 animate-in fade-in duration-200">
                        {actions}
                        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
                    </div>
                )}

                <button onClick={onSettingsClick} className="top-header-btn" title="Settings">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                </button>
                <div className="user-avatar" title={userName}>
                    {userName}
                </div>
            </div>
        </header>
    )
}
