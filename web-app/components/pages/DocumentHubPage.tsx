'use client'

import { useState } from 'react'
import AIAgentsDropdown from '@/components/AIAgentsDropdown'

interface DocumentHubPageProps {
    onAgentSelect: (agentId: string) => void
}

const sampleDocuments = [
    { id: '1', source: 'CALM', type: 'Solution Document', name: 'S4HANA Migration Strategy v2.1', updatedBy: 'Ankit Sharma', updatedOn: '2026-02-05', project: 'Project Phoenix' },
    { id: '2', source: 'SharePoint', type: 'Technical Spec', name: 'API Gateway Architecture', updatedBy: 'Priya Patel', updatedOn: '2026-02-04', project: 'Project Atlas' },
    { id: '3', source: 'Jira', type: 'Change document', name: 'CR-4521 Middleware Update', updatedBy: 'David Chen', updatedOn: '2026-02-03', project: 'Project Phoenix' },
    { id: '4', source: 'Solman', type: 'Decision Paper', name: 'Cloud vs On-Prem Assessment', updatedBy: 'Sarah Kim', updatedOn: '2026-02-02', project: 'Project Nebula' },
    { id: '5', source: 'CALM', type: 'Functional Spec', name: 'User Auth Module FS', updatedBy: 'Marco Rossi', updatedOn: '2026-02-01', project: 'Project Atlas' },
    { id: '6', source: 'SharePoint', type: 'Technical Spec', name: 'Data Pipeline Architecture', updatedBy: 'Ankit Sharma', updatedOn: '2026-01-30', project: 'Project Nebula' },
    { id: '7', source: 'Jira', type: 'Change document', name: 'CR-4587 Auth Service Refactor', updatedBy: 'Priya Patel', updatedOn: '2026-01-28', project: 'Project Phoenix' },
    { id: '8', source: 'CALM', type: 'Solution Document', name: 'Integration Testing Framework', updatedBy: 'Anna Müller', updatedOn: '2026-01-28', project: 'Project Phoenix' },
    { id: '9', source: 'Solman', type: 'Functional Spec', name: 'Payment Gateway Module', updatedBy: 'David Chen', updatedOn: '2026-01-27', project: 'Project Atlas' },
    { id: '10', source: 'SharePoint', type: 'Decision Paper', name: 'Microservices vs Monolith', updatedBy: 'Sarah Kim', updatedOn: '2026-01-25', project: 'Project Nebula' },
    { id: '11', source: 'CALM', type: 'Technical Spec', name: 'CI/CD Pipeline Design', updatedBy: 'Marco Rossi', updatedOn: '2026-01-24', project: 'Project Atlas' },
    { id: '12', source: 'Jira', type: 'Change document', name: 'CR-4602 Performance Tuning', updatedBy: 'Anna Müller', updatedOn: '2026-01-22', project: 'Project Phoenix' },
]

const sourceColors: Record<string, { bg: string; text: string }> = {
    CALM: { bg: '#dbeafe', text: '#1e40af' },
    SharePoint: { bg: '#d1fae5', text: '#065f46' },
    Jira: { bg: '#fee2e2', text: '#991b1b' },
    Solman: { bg: '#ffedd5', text: '#9a3412' },
}

export default function DocumentHubPage({ onAgentSelect }: DocumentHubPageProps) {
    const [sourceFilter, setSourceFilter] = useState('All Sources')
    const [typeFilter, setTypeFilter] = useState('All Types')
    const [projectFilter, setProjectFilter] = useState('All Projects')

    const filteredDocs = sampleDocuments.filter(doc => {
        if (sourceFilter !== 'All Sources' && doc.source !== sourceFilter) return false
        if (typeFilter !== 'All Types' && doc.type !== typeFilter) return false
        if (projectFilter !== 'All Projects' && doc.project !== projectFilter) return false
        return true
    })

    return (
        <div className="doc-hub-page">
            {/* Page Header */}
            <div className="doc-hub-header">
                <div className="doc-hub-header-left">
                    <div className="doc-hub-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="doc-hub-title">Document Hub</h1>
                        <p className="doc-hub-subtitle">Manage and explore your project documents across all sources</p>
                    </div>
                </div>
                <AIAgentsDropdown onAgentSelect={onAgentSelect} />
            </div>

            {/* Filters */}
            <div className="doc-hub-filters">
                <div className="doc-hub-filter-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>FILTERS</span>
                </div>
                <select className="doc-hub-filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option>All Sources</option>
                    <option>CALM</option>
                    <option>SharePoint</option>
                    <option>Jira</option>
                    <option>Solman</option>
                </select>
                <select className="doc-hub-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option>All Types</option>
                    <option>Solution Document</option>
                    <option>Technical Spec</option>
                    <option>Change document</option>
                    <option>Decision Paper</option>
                    <option>Functional Spec</option>
                </select>
                <select className="doc-hub-filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                    <option>All Projects</option>
                    <option>Project Phoenix</option>
                    <option>Project Atlas</option>
                    <option>Project Nebula</option>
                </select>
                <div className="doc-hub-date-filter">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Date Range</span>
                </div>
            </div>

            {/* Document Count */}
            <p className="doc-hub-count">
                <span className="doc-hub-count-num">{filteredDocs.length}</span> documents found
            </p>

            {/* Document Table */}
            <div className="doc-hub-table-wrapper">
                <table className="doc-hub-table">
                    <thead>
                        <tr>
                            <th>SOURCE</th>
                            <th>TYPE</th>
                            <th>DOCUMENT NAME</th>
                            <th>UPDATED BY</th>
                            <th>UPDATED ON</th>
                            <th>PROJECT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDocs.map((doc) => (
                            <tr key={doc.id}>
                                <td>
                                    <span
                                        className="doc-source-badge"
                                        style={{
                                            backgroundColor: sourceColors[doc.source]?.bg || '#f1f5f9',
                                            color: sourceColors[doc.source]?.text || '#475569',
                                        }}
                                    >
                                        {doc.source}
                                    </span>
                                </td>
                                <td className="doc-type-cell">{doc.type}</td>
                                <td className="doc-name-cell">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <span>{doc.name}</span>
                                </td>
                                <td>{doc.updatedBy}</td>
                                <td>{doc.updatedOn}</td>
                                <td>{doc.project}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
