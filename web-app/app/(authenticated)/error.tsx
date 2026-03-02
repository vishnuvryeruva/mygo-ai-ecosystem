'use client'

import { useEffect } from 'react'

export default function AuthenticatedError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Application error:', error)
    }, [error])

    return (
        <div className="page-content-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 className="page-main-title" style={{ marginBottom: '8px' }}>Something went wrong</h2>
            <p className="page-main-subtitle" style={{ marginBottom: '24px', maxWidth: '480px' }}>
                An unexpected error occurred. This has been logged and our team will look into it.
            </p>
            <button
                onClick={reset}
                style={{
                    padding: '10px 24px',
                    background: '#034354',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                }}
            >
                Try Again
            </button>
        </div>
    )
}
