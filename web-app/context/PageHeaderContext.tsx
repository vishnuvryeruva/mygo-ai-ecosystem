'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface PageHeaderConfig {
    title: ReactNode
    subtitle?: ReactNode
    icon?: ReactNode
    actions?: ReactNode
}

interface PageHeaderContextType {
    headerConfig: PageHeaderConfig | null
    setHeaderConfig: (config: PageHeaderConfig | null) => void
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
    const [headerConfig, setHeaderConfig] = useState<PageHeaderConfig | null>(null)

    return (
        <PageHeaderContext.Provider value={{ headerConfig, setHeaderConfig }}>
            {children}
        </PageHeaderContext.Provider>
    )
}

export function usePageHeaderContext() {
    const context = useContext(PageHeaderContext)
    if (!context) {
        throw new Error('usePageHeaderContext must be used within a PageHeaderProvider')
    }
    return context
}

/**
 * Hook to set the page header configuration in the navbar.
 */
export function usePageHeader(config: PageHeaderConfig | null, deps: any[] = []) {
    const { setHeaderConfig } = usePageHeaderContext()

    useEffect(() => {
        setHeaderConfig(config)
        return () => {
            setHeaderConfig(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setHeaderConfig, ...deps])
}
