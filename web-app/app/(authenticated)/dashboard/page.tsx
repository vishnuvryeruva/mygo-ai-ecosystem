'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

const documentTypeNames: Record<string, string> = {
    NT: 'Note',
    FS: 'Functional Spec',
    TS: 'Technical Spec',
    SD: 'Solution Document',
    CD: 'Change Document',
    DP: 'Decision Paper',
    REQUIREMENT: 'Requirement',
}

const resolveTypeLabel = (rawType: string) => documentTypeNames[rawType] || rawType || 'Unknown'

type DocTypeStat = {
    label: string
    count: number
    maxCount: number
}

type ModuleStat = {
    code: string
    label: string
    count: number
    maxCount: number
}

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

const abapByType = [
    { label: 'Classes', count: 142, maxCount: 150 },
    { label: 'Function Modules', count: 87, maxCount: 150 },
    { label: 'Reports', count: 56, maxCount: 150 },
    { label: 'Interfaces', count: 34, maxCount: 150 },
]

export default function DashboardPage() {
    const [projectFilter, setProjectFilter] = useState('')
    const [moduleFilter, setModuleFilter] = useState('')
    const [projectOptions, setProjectOptions] = useState<string[]>([])
    const [docsByType, setDocsByType] = useState<DocTypeStat[]>([])
    const [docsByModule, setDocsByModule] = useState<ModuleStat[]>([])
    const [needsReview, setNeedsReview] = useState(0)
    const [isLoadingDocsByType, setIsLoadingDocsByType] = useState(true)
    const [docsByTypeError, setDocsByTypeError] = useState('')

    const fetchDocumentStats = useCallback(async (project: string, module: string) => {
        setIsLoadingDocsByType(true)
        setDocsByTypeError('')
        try {
            const params = new URLSearchParams()
            if (project) params.set('project', project)
            if (module) params.set('module', module)
            const query = params.toString()
            const res = await axios.get(`/api/dashboard/stats${query ? `?${query}` : ''}`)
            const byType: { type?: string; count?: number }[] = res.data.documents_by_type ?? []
            const byModule: { module?: string; label?: string; count?: number }[] =
                res.data.documents_by_module ?? []
            const projects: string[] = res.data.projects ?? []
            const maxCount = Math.max(1, ...byType.map((item) => Number(item.count) || 0))
            const maxModuleCount = Math.max(1, ...byModule.map((item) => Number(item.count) || 0))

            setProjectOptions(projects)
            setNeedsReview(Number(res.data.needs_review) || 0)
            setDocsByType(
                byType.map((item) => ({
                    label: resolveTypeLabel(item.type || 'Unknown'),
                    count: Number(item.count) || 0,
                    maxCount,
                }))
            )
            setDocsByModule(
                byModule.map((item) => ({
                    code: item.module || 'UNCLASSIFIED',
                    label: item.label || item.module || 'Unclassified',
                    count: Number(item.count) || 0,
                    maxCount: maxModuleCount,
                }))
            )
        } catch (err) {
            console.error('Failed to fetch document stats:', err)
            setDocsByType([])
            setDocsByModule([])
            setDocsByTypeError('Unable to load document stats.')
        } finally {
            setIsLoadingDocsByType(false)
        }
    }, [])

    useEffect(() => {
        fetchDocumentStats(projectFilter, moduleFilter)
    }, [projectFilter, moduleFilter, fetchDocumentStats])

    // A module selected under one project rarely exists under the next.
    const handleProjectChange = (project: string) => {
        setProjectFilter(project)
        setModuleFilter('')
    }

    const selectedModule = docsByModule.find((item) => item.code === moduleFilter)
    const typeChartTitle = selectedModule
        ? `Documents by Type — ${selectedModule.label}`
        : 'Documents by Type'

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
                    <div className="dashboard-chart-header">
                        <h3 className="dashboard-chart-title">Documents by Module</h3>
                        <select
                            className="doc-hub-filter-select"
                            value={projectFilter}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            aria-label="Filter documents by project"
                        >
                            <option value="">All Projects</option>
                            {projectOptions.map((project) => (
                                <option key={project} value={project}>{project}</option>
                            ))}
                        </select>
                    </div>
                    <div className="dashboard-chart-bars">
                        {isLoadingDocsByType ? (
                            <p className="dashboard-chart-empty">Loading document stats…</p>
                        ) : docsByTypeError ? (
                            <p className="dashboard-chart-empty">{docsByTypeError}</p>
                        ) : docsByModule.length === 0 ? (
                            <p className="dashboard-chart-empty">
                                {projectFilter
                                    ? 'No documents found for this project.'
                                    : 'No documents available yet.'}
                            </p>
                        ) : (
                            docsByModule.map((item) => {
                                const isSelected = item.code === moduleFilter
                                return (
                                    <button
                                        key={item.code}
                                        type="button"
                                        className={`dashboard-bar-row dashboard-bar-row-clickable${isSelected ? ' is-selected' : ''}`}
                                        onClick={() => setModuleFilter(isSelected ? '' : item.code)}
                                        aria-pressed={isSelected}
                                        title={isSelected
                                            ? `Clear the ${item.label} filter`
                                            : `Show only ${item.label} documents`}
                                    >
                                        <span className="dashboard-bar-label">{item.label}</span>
                                        <div className="dashboard-bar-track">
                                            <div
                                                className="dashboard-bar-fill"
                                                style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="dashboard-bar-count">{item.count}</span>
                                    </button>
                                )
                            })
                        )}
                    </div>
                    {needsReview > 0 && (
                        <p className="dashboard-chart-note">
                            {needsReview} document{needsReview === 1 ? '' : 's'} classified with low
                            confidence — review {needsReview === 1 ? 'it' : 'them'} in the Document Hub.
                        </p>
                    )}
                </div>

                <div className="dashboard-chart-card">
                    <div className="dashboard-chart-header">
                        <h3 className="dashboard-chart-title">{typeChartTitle}</h3>
                        {moduleFilter && (
                            <button
                                type="button"
                                className="dashboard-chart-clear"
                                onClick={() => setModuleFilter('')}
                            >
                                Clear filter
                            </button>
                        )}
                    </div>
                    <div className="dashboard-chart-bars">
                        {isLoadingDocsByType ? (
                            <p className="dashboard-chart-empty">Loading document stats…</p>
                        ) : docsByTypeError ? (
                            <p className="dashboard-chart-empty">{docsByTypeError}</p>
                        ) : docsByType.length === 0 ? (
                            <p className="dashboard-chart-empty">
                                {moduleFilter
                                    ? 'No documents found for this module.'
                                    : projectFilter
                                        ? 'No documents found for this project.'
                                        : 'No documents available yet.'}
                            </p>
                        ) : (
                            docsByType.map((item, i) => (
                                <div key={`${item.label}-${i}`} className="dashboard-bar-row">
                                    <span className="dashboard-bar-label">{item.label}</span>
                                    <div className="dashboard-bar-track">
                                        <div
                                            className="dashboard-bar-fill"
                                            style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="dashboard-bar-count">{item.count}</span>
                                </div>
                            ))
                        )}
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
