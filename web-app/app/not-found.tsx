import Link from 'next/link'

export default function NotFound() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#f8fafc',
                textAlign: 'center',
                padding: '24px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
        >
            <div style={{ fontSize: '80px', marginBottom: '16px', lineHeight: 1 }}>404</div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                Page Not Found
            </h1>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px', maxWidth: '420px' }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link
                href="/dashboard"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    background: '#034354',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
            </Link>
        </div>
    )
}
