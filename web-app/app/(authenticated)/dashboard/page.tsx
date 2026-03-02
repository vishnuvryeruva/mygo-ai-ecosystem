'use client'

import { Metadata } from 'next'

// Stats data
const stats = [
    {
        title: 'Total Sources', value: '4', subtitle: 'CALM, SharePoint, Jira, Solman', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            </svg>
        )
    },
    {
        title: 'Total Documents', value: '12', subtitle: 'Across all sources', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
        )
    },
    {
        title: 'Last Updated', value: '2/4/2026', subtitle: '7:00:00 PM', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        )
    },
    {
        title: 'ABAP Objects', value: '319', subtitle: '4 object types', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        )
    },
]

const docsByType = [
    { label: 'Solution Document', count: 3, maxCount: 5 },
    { label: 'Decision Paper', count: 2, maxCount: 5 },
    { label: 'Functional Spec', count: 2, maxCount: 5 },
    { label: 'Technical Spec', count: 3, maxCount: 5 },
    { label: 'Change document', count: 2, maxCount: 5 },
]

const abapByType = [
    { label: 'Classes', count: 142, maxCount: 150 },
    { label: 'Function Modules', count: 87, maxCount: 150 },
    { label: 'Reports', count: 56, maxCount: 150 },
    { label: 'Interfaces', count: 34, maxCount: 150 },
]

export default function DashboardPage() {
    return (
        <div className="page-content-area">
            <h1 className="page-main-title">Dashboard</h1>
            <p className="page-main-subtitle">Overview of your project ecosystem</p>

            {/* Stats Cards */}
            <div className="dashboard-stats-grid">
                {stats.map((stat, i) => (
                    <div key={i} className="dashboard-stat-card">
                        <div className="dashboard-stat-header">
                            <span className="dashboard-stat-label">{stat.title}</span>
                            <span className="dashboard-stat-icon">{stat.icon}</span>
                        </div>
                        <div className="dashboard-stat-value">{stat.value}</div>
                        <div className="dashboard-stat-subtitle">{stat.subtitle}</div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="dashboard-charts-grid">
                <div className="dashboard-chart-card">
                    <h3 className="dashboard-chart-title">Documents by Type</h3>
                    <div className="dashboard-chart-bars">
                        {docsByType.map((item, i) => (
                            <div key={i} className="dashboard-bar-row">
                                <span className="dashboard-bar-label">{item.label}</span>
                                <div className="dashboard-bar-track">
                                    <div
                                        className="dashboard-bar-fill"
                                        style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                                    />
                                </div>
                                <span className="dashboard-bar-count">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dashboard-chart-card">
                    <h3 className="dashboard-chart-title">ABAP Objects by Type</h3>
                    <div className="dashboard-chart-bars">
                        {abapByType.map((item, i) => (
                            <div key={i} className="dashboard-bar-row">
                                <span className="dashboard-bar-label">{item.label}</span>
                                <div className="dashboard-bar-track">
                                    <div
                                        className="dashboard-bar-fill"
                                        style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                                    />
                                </div>
                                <span className="dashboard-bar-count">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
