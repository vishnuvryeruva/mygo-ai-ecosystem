'use client'

import { ReactNode } from 'react'

interface DashboardLayoutProps {
    children: ReactNode
    title: string
    subtitle?: string
    actions?: ReactNode
}

export default function DashboardLayout({
    children,
    title,
    subtitle,
    actions
}: DashboardLayoutProps) {
    return (
        <div className="main-content">
            {/* Animated Background */}
            <div className="animated-background" />

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="page-subtitle">{subtitle}</p>}
                </div>
                {actions && (
                    <div className="flex items-center gap-3">
                        {actions}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}
