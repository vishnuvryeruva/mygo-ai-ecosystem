export default function AuthenticatedLoading() {
    return (
        <div className="page-content-area">
            {/* Title skeleton */}
            <div style={{ width: '200px', height: '28px', background: '#e2e8f0', borderRadius: '6px', marginBottom: '8px' }} />
            <div style={{ width: '300px', height: '16px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '24px' }} />

            {/* Stats skeleton */}
            <div className="dashboard-stats-grid">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="dashboard-stat-card" style={{ opacity: 0.6 }}>
                        <div style={{ width: '80px', height: '14px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '12px' }} />
                        <div style={{ width: '40px', height: '32px', background: '#e2e8f0', borderRadius: '6px', marginBottom: '8px' }} />
                        <div style={{ width: '120px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
                    </div>
                ))}
            </div>

            {/* Content skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {[1, 2].map((i) => (
                    <div key={i} className="dashboard-chart-card" style={{ opacity: 0.5 }}>
                        <div style={{ width: '160px', height: '18px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '16px' }} />
                        {[1, 2, 3].map((j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ width: '100px', height: '12px', background: '#f1f5f9', borderRadius: '4px' }} />
                                <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px' }} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
