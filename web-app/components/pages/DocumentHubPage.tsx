'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import GlobalAIAgentsDropdown from '@/components/GlobalAIAgentsDropdown'
import SyncSourceModal from '@/components/modals/SyncSourceModal'

interface Document {
    id: string
    name: string
    type: string
    source: string
    project: string
    updatedBy: string
    updatedOn: string
    updatedAt: number
    webUrl?: string
    documentId?: string
    documentTypeCode?: string
}

interface PaginationMeta {
    total: number
    page: number
    page_size: number
    total_pages: number
}

const PAGE_SIZE = 10

const sourceColors: Record<string, { bg: string; text: string }> = {
    CALM: { bg: '#dbeafe', text: '#1e40af' },
    SharePoint: { bg: '#d1fae5', text: '#065f46' },
    Jira: { bg: '#fee2e2', text: '#991b1b' },
    Solman: { bg: '#ffedd5', text: '#9a3412' },
}

const documentTypeNames: Record<string, string> = {
    NT: 'Note',
    FS: 'Functional Spec',
    TS: 'Technical Spec',
    SD: 'Solution Document',
    CD: 'Change Document',
    DP: 'Decision Paper',
}

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DocumentHubPage() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, page: 1, page_size: PAGE_SIZE, total_pages: 1 })

    // Server-side filters
    const [search, setSearch] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [projectFilter, setProjectFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    // Filter option lists (populated from first unfiltered fetch)
    const [sourceOptions, setSourceOptions] = useState<string[]>([])
    const [typeOptions, setTypeOptions] = useState<string[]>([])
    const [projectOptions, setProjectOptions] = useState<string[]>([])
    const optionsLoaded = useRef(false)

    const [showSyncModal, setShowSyncModal] = useState(false)

    const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const [viewerDoc, setViewerDoc] = useState<{ name: string; content: string } | null>(null)
    const [isLoadingContent, setIsLoadingContent] = useState(false)

    // Debounce search input
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchDocuments = useCallback(async (page: number = 1) => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', String(page))
            params.set('page_size', String(PAGE_SIZE))
            if (search) params.set('search', search)
            if (sourceFilter) params.set('source', sourceFilter)
            if (typeFilter) params.set('type', typeFilter)
            if (projectFilter) params.set('project', projectFilter)
            if (dateFrom) params.set('date_from', dateFrom)
            if (dateTo) params.set('date_to', dateTo)

            const res = await axios.get(`/api/documents?${params.toString()}`)
            const { documents: rawDocs, total, total_pages, page: pg, page_size } = res.data

            const mappedDocs: Document[] = (rawDocs ?? []).map((doc: any) => {
                const docId = doc.documentId || doc.document_id || doc.uuid || doc.id || doc.name || doc.filename
                const docName = doc.title || doc.name || doc.metadata?.name || doc.filename
                const docTypeCode = doc.documentTypeCode || doc.type || doc.metadata?.documentType
                const docType = documentTypeNames[docTypeCode] || docTypeCode || 'Document'
                const rawDate = doc.modifiedAt || doc.updatedOn || doc.metadata?.updatedAt || doc.metadata?.modifiedAt || null
                const parsedTs = rawDate ? new Date(rawDate).getTime() : NaN
                const resolvedUpdatedBy = doc.updatedBy || doc.changedBy || doc.lastChangedBy || doc.modifiedBy || doc.metadata?.updatedBy || doc.metadata?.changedBy || null
                return {
                    id: docId,
                    name: docName,
                    type: docType,
                    source: doc.source || doc.metadata?.source || 'File Upload',
                    project: doc.project || doc.metadata?.project || 'N/A',
                    updatedBy: resolvedUpdatedBy || 'System',
                    updatedOn: formatDate(rawDate),
                    updatedAt: isNaN(parsedTs) ? 0 : parsedTs,
                    webUrl: doc.webUrl || doc.metadata?.webUrl,
                    documentId: docId,
                }
            })

            setDocuments(mappedDocs)
            setPagination({ total: total ?? 0, page: pg ?? page, page_size: page_size ?? PAGE_SIZE, total_pages: total_pages ?? 1 })
            setCurrentPage(pg ?? page)
        } catch (err) {
            console.error('Failed to fetch documents:', err)
        } finally {
            setIsLoading(false)
        }
    }, [search, sourceFilter, typeFilter, projectFilter, dateFrom, dateTo])

    // Load filter options once on mount (unfiltered, large page)
    useEffect(() => {
        if (optionsLoaded.current) return
        optionsLoaded.current = true
        axios.get('/api/documents?page=1&page_size=1000').then(res => {
            const docs: any[] = res.data.documents ?? []
            setSourceOptions([...new Set<string>(docs.map(d => d.source).filter(Boolean))].sort())
            setTypeOptions([...new Set<string>(docs.map(d => d.type || d.doc_type).filter(Boolean))].sort())
            setProjectOptions([...new Set<string>(docs.map(d => d.project).filter(p => p && p !== 'N/A'))].sort())
        }).catch(() => {})
    }, [])

    // Re-fetch when filters change (reset to page 1)
    useEffect(() => {
        fetchDocuments(1)
        setSelectedDocumentIds(new Set())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceFilter, typeFilter, projectFilter, dateFrom, dateTo])

    // Debounced search
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            fetchDocuments(1)
            setSelectedDocumentIds(new Set())
        }, 400)
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])



    const toggleDocumentSelection = (id: string) => {
        setSelectedDocumentIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleSelectAllDocuments = () => {
        if (selectedDocumentIds.size === documents.length) {
            setSelectedDocumentIds(new Set())
        } else {
            setSelectedDocumentIds(new Set(documents.map(d => d.id)))
        }
    }

    const handleDeleteSelected = async () => {
        setIsDeleting(true)
        setShowDeleteConfirm(false)
        try {
            await Promise.all(
                Array.from(selectedDocumentIds).map((id) =>
                    axios.delete(`/api/documents/${encodeURIComponent(id)}`)
                )
            )
            setSelectedDocumentIds(new Set())
            await fetchDocuments(currentPage)
        } catch (err) {
            console.error('Delete failed:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    const goToPage = (page: number) => {
        if (page < 1 || page > pagination.total_pages) return
        fetchDocuments(page)
    }

    const openDocumentViewer = async (doc: Document) => {
        const docId = doc.documentId || doc.id
        if (!docId) return
        setIsLoadingContent(true)
        setViewerDoc({ name: doc.name, content: '' })
        try {
            // Check if this is a test case
            const isTestCase = doc.type === 'Manual Test Case' || (doc as any).documentTypeCode === 'TEST_CASE'

            if (isTestCase) {
                // Fetch test case details
                const res = await axios.get(`/api/test-cases/${docId}`)
                const testCase = res.data

                console.log('Test case data:', testCase)

                // Format test case as HTML for display with better styling
                let html = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; line-height: 1.6;">
                        <h1 style="color: #1f2937; margin-bottom: 20px; font-size: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                            ${testCase.title || 'Test Case'}
                        </h1>
                        
                        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="margin: 5px 0;">
                                <strong style="color: #374151;">Priority:</strong> 
                                <span style="padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 500; ${testCase.priorityCode === 30 ? 'background: #fee2e2; color: #991b1b;' :
                        testCase.priorityCode === 20 ? 'background: #fef3c7; color: #92400e;' :
                            'background: #dbeafe; color: #1e40af;'
                    }">
                                    ${testCase.priorityCode === 10 ? 'Low' : testCase.priorityCode === 20 ? 'Medium' : testCase.priorityCode === 30 ? 'High' : 'Unknown'}
                                </span>
                            </p>
                            <p style="margin: 5px 0;">
                                <strong style="color: #374151;">Status:</strong> 
                                <span style="padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 500; ${testCase.isPrepared ? 'background: #d1fae5; color: #065f46;' : 'background: #e5e7eb; color: #6b7280;'
                    }">
                                    ${testCase.isPrepared ? 'Prepared' : 'Not Prepared'}
                                </span>
                            </p>
                        </div>
                `

                if (testCase.toActivities && testCase.toActivities.length > 0) {
                    html += '<h2 style="color: #1f2937; margin-top: 30px; margin-bottom: 15px; font-size: 20px;">Test Activities</h2>'

                    testCase.toActivities.forEach((activity: any, actIdx: number) => {
                        html += `
                            <div style="margin-bottom: 25px; padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <h3 style="color: #7c3aed; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                                    <span style="background: #7c3aed; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px; font-weight: bold;">
                                        ${activity.sequence || actIdx + 1}
                                    </span>
                                    ${activity.title}
                                </h3>
                        `

                        if (activity.toActions && activity.toActions.length > 0) {
                            html += '<div style="margin-left: 38px;">'

                            activity.toActions.forEach((action: any, actionIdx: number) => {
                                html += `
                                    <div style="margin-bottom: 15px; padding: 15px; background: #f9fafb; border-left: 3px solid #7c3aed; border-radius: 4px;">
                                        <div style="display: flex; align-items: start; margin-bottom: 8px;">
                                            <span style="background: #e9d5ff; color: #6b21a8; min-width: 24px; height: 24px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px; font-weight: bold;">
                                                ${action.sequence || actionIdx + 1}
                                            </span>
                                            <strong style="color: #1f2937; font-size: 15px;">${action.title}</strong>
                                        </div>
                                `

                                if (action.description && action.description.trim()) {
                                    html += `
                                        <div style="margin: 10px 0 10px 34px; padding: 10px; background: white; border-radius: 4px;">
                                            <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 5px;">Description</div>
                                            <div style="color: #374151;">${action.description}</div>
                                        </div>
                                    `
                                }

                                if (action.expectedResult && action.expectedResult.trim()) {
                                    html += `
                                        <div style="margin: 10px 0 10px 34px; padding: 10px; background: #ecfdf5; border-radius: 4px; border-left: 3px solid #10b981;">
                                            <div style="color: #047857; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 5px;">✓ Expected Result</div>
                                            <div style="color: #065f46; font-weight: 500;">${action.expectedResult}</div>
                                        </div>
                                    `
                                }

                                if (action.isEvidenceRequired) {
                                    html += `
                                        <div style="margin: 10px 0 0 34px;">
                                            <span style="display: inline-block; padding: 4px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 12px; font-weight: 500;">
                                                📸 Evidence Required
                                            </span>
                                        </div>
                                    `
                                }

                                html += '</div>'
                            })

                            html += '</div>'
                        }

                        html += '</div>'
                    })
                }

                // Add references if available
                if (testCase.toReferences && testCase.toReferences.length > 0) {
                    html += '<h2 style="color: #1f2937; margin-top: 30px; margin-bottom: 15px; font-size: 20px;">References</h2>'
                    html += '<div style="background: #f9fafb; padding: 15px; border-radius: 8px;">'

                    testCase.toReferences.forEach((ref: any) => {
                        html += `
                            <div style="margin-bottom: 10px;">
                                <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                                    🔗 ${ref.name}
                                </a>
                            </div>
                        `
                    })

                    html += '</div>'
                }

                html += '</div>'

                setViewerDoc({ name: doc.name, content: html })
            } else {
                // Regular document (CALM or File Upload)
                const res = await axios.get(`/api/documents/${encodeURIComponent(docId)}/view`)
                setViewerDoc({ name: doc.name, content: res.data.content || '' })
            }
        } catch (err: any) {
            const errMsg = err?.response?.data?.error || 'Failed to load content.'
            setViewerDoc({ name: doc.name, content: `<p style="color:red">${errMsg}</p>` })
        } finally {
            setIsLoadingContent(false)
        }
    }

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
                <div className="flex gap-3">
                    <button className="btn btn-primary" onClick={() => setShowSyncModal(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                            <path d="M21 2v6h-6" />
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M3 22v-6h6" />
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        Sync Source
                    </button>
                    <GlobalAIAgentsDropdown />
                </div>
            </div>

            {/* Search + Filters */}
            <div className="doc-hub-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className="doc-hub-filter-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>FILTERS</span>
                </div>

                {/* Search box */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search documents…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="doc-hub-filter-select"
                        style={{ paddingLeft: 28, minWidth: 180 }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13, lineHeight: 1 }}>✕</button>
                    )}
                </div>

                <select className="doc-hub-filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="">All Sources</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="doc-hub-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">All Types</option>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="doc-hub-filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                    <option value="">All Projects</option>
                    {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="doc-hub-date-filter">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        title="Updated on — from"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: dateFrom ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>–</span>
                    <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        title="Updated on — to"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: dateTo ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
                    />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo('') }} title="Clear date filter"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>✕</button>
                    )}
                </div>
            </div>

            {/* Document Count & Bulk Actions */}
            <div className="flex items-center justify-between mb-2">
                <p className="doc-hub-count" style={{ margin: 0 }}>
                    <span className="doc-hub-count-num">{pagination.total}</span> documents found
                    {pagination.total_pages > 1 && (
                        <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 13, marginLeft: 6 }}>
                            — page {pagination.page} of {pagination.total_pages}
                        </span>
                    )}
                </p>
                {selectedDocumentIds.size > 0 && (
                    <button
                        className="btn"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isDeleting}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                        </svg>
                        {isDeleting ? 'Deleting...' : `Delete (${selectedDocumentIds.size})`}
                    </button>
                )}
            </div>

            {/* Document Table */}
            <div className="doc-hub-table-wrapper">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading documents...</div>
                ) : (
                    <table className="doc-hub-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40, textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={documents.length > 0 && selectedDocumentIds.size === documents.length}
                                        onChange={toggleSelectAllDocuments}
                                        style={{ cursor: 'pointer' }}
                                        title="Select all on this page"
                                    />
                                </th>
                                <th>SOURCE</th>
                                <th>TYPE</th>
                                <th>DOCUMENT NAME</th>
                                <th>UPDATED BY</th>
                                <th>UPDATED ON</th>
                                <th>PROJECT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((doc) => (
                                <tr key={doc.id} style={selectedDocumentIds.has(doc.id) ? { backgroundColor: '#f0f7ff' } : {}}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDocumentIds.has(doc.id)}
                                            onChange={() => toggleDocumentSelection(doc.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </td>
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
                                        {(doc.source === 'CALM' || doc.source === 'File Upload') && (doc.documentId || doc.id) ? (
                                            <button
                                                onClick={() => openDocumentViewer(doc)}
                                                className="hover:underline text-left text-blue-600 font-medium"
                                                title="Click to view this document"
                                            >
                                                {doc.name}
                                            </button>
                                        ) : doc.webUrl ? (
                                            <a href={doc.webUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 font-medium overflow-hidden text-ellipsis whitespace-nowrap" title="Click to view external link">
                                                {doc.name}
                                            </a>
                                        ) : (
                                            <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={doc.name}>{doc.name}</span>
                                        )}
                                    </td>
                                    <td>{doc.updatedBy}</td>
                                    <td>{doc.updatedOn}</td>
                                    <td>{doc.project}</td>
                                </tr>
                            ))}
                            {documents.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center p-8 text-gray-400">
                                        No documents found. Try adjusting filters or syncing a source.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 0' }}>
                    <button
                        onClick={() => goToPage(1)}
                        disabled={pagination.page <= 1}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', color: pagination.page <= 1 ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="First page"
                    >«</button>
                    <button
                        onClick={() => goToPage(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', color: pagination.page <= 1 ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Previous page"
                    >‹</button>

                    {/* Page number buttons */}
                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === pagination.total_pages || Math.abs(p - pagination.page) <= 2)
                        .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                            acc.push(p)
                            return acc
                        }, [])
                        .map((p, idx) =>
                            p === '…' ? (
                                <span key={`ellipsis-${idx}`} style={{ padding: '6px 4px', color: '#94a3b8', fontSize: 13 }}>…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => goToPage(p as number)}
                                    style={{
                                        padding: '6px 11px', border: '1px solid', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                                        borderColor: p === pagination.page ? '#034354' : '#e2e8f0',
                                        background: p === pagination.page ? '#034354' : 'white',
                                        color: p === pagination.page ? 'white' : '#475569',
                                        fontWeight: p === pagination.page ? 600 : 400,
                                    }}
                                >{p}</button>
                            )
                        )
                    }

                    <button
                        onClick={() => goToPage(pagination.page + 1)}
                        disabled={pagination.page >= pagination.total_pages}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer', color: pagination.page >= pagination.total_pages ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Next page"
                    >›</button>
                    <button
                        onClick={() => goToPage(pagination.total_pages)}
                        disabled={pagination.page >= pagination.total_pages}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer', color: pagination.page >= pagination.total_pages ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Last page"
                    >»</button>
                </div>
            )}

            {/* Document Viewer Modal */}
            {viewerDoc && (
                <div className="settings-modal-overlay" onClick={() => setViewerDoc(null)}>
                    <div
                        className="settings-modal"
                        style={{ maxWidth: 860, width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="settings-modal-header">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 className="settings-modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {viewerDoc.name}
                                </h3>
                                <p className="settings-modal-desc">Document content</p>
                            </div>
                            <button className="settings-modal-close" onClick={() => setViewerDoc(null)}>×</button>
                        </div>
                        <div
                            className="settings-modal-body"
                            style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}
                        >
                            {isLoadingContent ? (
                                <div className="text-center p-8">
                                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading document content...</p>
                                </div>
                            ) : (
                                <div
                                    className="prose max-w-none"
                                    style={{ fontSize: 14, lineHeight: 1.7 }}
                                    dangerouslySetInnerHTML={{ __html: viewerDoc.content }}
                                />
                            )}
                        </div>
                        <div className="settings-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setViewerDoc(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
                    <div className="modal max-w-md">
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Documents</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-main">
                                Are you sure you want to delete <strong className="text-heading">{selectedDocumentIds.size} document{selectedDocumentIds.size > 1 ? 's' : ''}</strong> from your account? This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                className="btn"
                                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Modal */}
            <SyncSourceModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                onSyncComplete={fetchDocuments}
            />
        </div>
    )
}
