'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
    id: string
    label: string
    href: string
    icon: React.ReactNode
}

const navItems: NavItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
            </svg>
        ),
    },
    {
        id: 'document-hub',
        label: 'Document Hub',
        href: '/document-hub',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
    {
        id: 'code-repository',
        label: 'Code Repository',
        href: '/code-repository',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        ),
    },
    {
        id: 'agents',
        label: 'Agent Builder',
        href: '/agents',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
        ),
    },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <h1>YODA</h1>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <div className="nav-section-title">NAVIGATION</div>
                {navItems.map((item) => (
                    <Link
                        key={item.id}
                        href={item.href}
                        className={`nav-item ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    )
}
