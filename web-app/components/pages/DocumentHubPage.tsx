'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AIAgentsDropdown from '@/components/AIAgentsDropdown'

interface DocumentHubPageProps {
    onAgentSelect: (agentId: string) => void
}

interface Source {
    id: string
    name: string
    type: string
}

interface Project {
    id: string
    name: string
    webUrl?: string
}

interface Document {
    id: string
    name: string
    type: string
    source: string
    project: string
    updatedBy: string
    updatedOn: string
    webUrl?: string
}

const sourceColors: Record<string, { bg: string; text: string }> = {
    CALM: { bg: '#dbeafe', text: '#1e40af' },
    SharePoint: { bg: '#d1fae5', text: '#065f46' },
    Jira: { bg: '#fee2e2', text: '#991b1b' },
    Solman: { bg: '#ffedd5', text: '#9a3412' },
}

// Map SAP document type codes to human-readable names
const documentTypeNames: Record<string, string> = {
    NT: 'Note',
    FS: 'Functional Spec',
    TS: 'Technical Spec',
    SD: 'Solution Document',
    CD: 'Change Document',
    DP: 'Decision Paper',
}

export default function DocumentHubPage({ onAgentSelect }: DocumentHubPageProps) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Filters
    const [sourceFilter, setSourceFilter] = useState('All Sources')
    const [typeFilter, setTypeFilter] = useState('All Types')
    const [projectFilter, setProjectFilter] = useState('All Projects')

    // Sync Modal State
    const [showSyncModal, setShowSyncModal] = useState(false)
    const [syncStep, setSyncStep] = useState(1) // 1: Source, 2: Project, 3: Fetching/Confirm, 4: Result

    // Sync Data State
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSource, setSelectedSource] = useState('')

    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState('')

    const [docsToSync, setDocsToSync] = useState<any[]>([])
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
    const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({})
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncResult, setSyncResult] = useState<{ message: string; count: number; updated: number; added: number } | null>(null)

    // Load initial documents
    useEffect(() => {
        fetchDocuments()
    }, [])

    // Load sources when modal opens
    useEffect(() => {
        if (showSyncModal && sources.length === 0) {
            fetchSources()
        }
    }, [showSyncModal])

    // Load projects when source selected
    useEffect(() => {
        if (selectedSource && syncStep === 2) {
            fetchProjects(selectedSource)
        }
    }, [selectedSource, syncStep])

    const fetchDocuments = async () => {
        setIsLoading(true)
        try {
            const res = await axios.get('http://localhost:5001/api/documents')
            // Map backend docs to frontend format
            const mappedDocs = res.data.documents.map((doc: any) => {
                // Handle both old and new API response formats
                const docId = doc.uuid || doc.id || doc.name || doc.filename
                const docName = doc.title || doc.name || doc.metadata?.name || doc.filename
                const docTypeCode = doc.documentTypeCode || doc.type || doc.metadata?.documentType
                const docType = documentTypeNames[docTypeCode] || docTypeCode || 'Document'
                
                return {
                    id: docId,
                    name: docName,
                    type: docType,
                    source: doc.source || doc.metadata?.source || 'File Upload',
                    project: doc.project || doc.metadata?.project || 'N/A',
                    updatedBy: doc.updatedBy || doc.metadata?.updatedBy || 'System',
                    updatedOn: doc.updatedOn || (doc.modifiedAt ? new Date(doc.modifiedAt).toLocaleDateString() : (doc.metadata?.updatedAt ? new Date(doc.metadata.updatedAt).toLocaleDateString() : 'N/A')),
                    webUrl: doc.webUrl || doc.metadata?.webUrl
                }
            })
            setDocuments(mappedDocs)
        } catch (err) {
            console.error('Failed to fetch documents:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchSources = async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/sources')
            setSources(res.data.sources || [])
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        }
    }

    const fetchProjects = async (sourceId: string) => {
        setProjects([]) // Clear previous
        try {
            const res = await axios.get(`http://localhost:5001/api/calm/${sourceId}/projects`)
            setProjects(res.data.projects || [])
        } catch (err) {
            console.error('Failed to fetch projects:', err)
        }
    }

    const handleSyncNext = async () => {
        if (syncStep === 1 && selectedSource) {
            setSyncStep(2)
        } else if (syncStep === 2 && selectedProject) {
            setSyncStep(3)
            // Fetch potential docs to sync
            setIsSyncing(true)
            try {
                const res = await axios.get(`http://localhost:5001/api/calm/${selectedSource}/documents?projectId=${selectedProject}`)
                const docs = res.data.documents || []
                setDocsToSync(docs)
                
                // Check sync status for all documents
                const docIds = docs.map((doc: any) => doc.uuid || doc.id)
                const statusRes = await axios.post('http://localhost:5001/api/sync/check', {
                    documentIds: docIds
                })
                setSyncStatus(statusRes.data.syncStatus || {})
                
                // Select all documents by default
                setSelectedDocIds(new Set(docIds))
            } catch (err) {
                console.error('Failed to fetch docs from source:', err)
            } finally {
                setIsSyncing(false)
            }
        } else if (syncStep === 3) {
            // Perform actual sync (only selected documents)
            setIsSyncing(true)
            try {
                // Filter to only sync selected documents
                const selectedDocs = docsToSync.filter(doc => {
                    const docId = doc.uuid || doc.id
                    return selectedDocIds.has(docId)
                })
                
                if (selectedDocs.length === 0) {
                    alert('Please select at least one document to sync.')
                    setIsSyncing(false)
                    return
                }
                
                const res = await axios.post('http://localhost:5001/api/sync', {
                    sourceId: selectedSource,
                    documents: selectedDocs.map(doc => ({
                        ...doc,
                        id: doc.uuid || doc.id,
                        name: doc.title || doc.name,
                        type: doc.documentTypeCode || doc.documentType || doc.type,
                        metadata: {
                            ...doc,
                            uuid: doc.uuid,
                            title: doc.title,
                            displayId: doc.displayId,
                            documentTypeCode: doc.documentTypeCode,
                            projectId: doc.projectId,
                            scopeId: doc.scopeId,
                            statusCode: doc.statusCode,
                            createdAt: doc.createdAt,
                            modifiedAt: doc.modifiedAt,
                            source: sources.find(s => s.id === selectedSource)?.type || 'CALM',
                            project: projects.find(p => p.id === selectedProject)?.name || 'Unknown Project'
                        }
                    }))
                })
                
                // Count updated vs newly added
                const results = res.data.results || []
                const updated = results.filter((r: any) => r.wasExisting).length
                const added = results.filter((r: any) => !r.wasExisting && r.status === 'success').length
                
                setSyncResult({ 
                    message: res.data.message, 
                    count: results.length,
                    updated: updated,
                    added: added
                })
                setSyncStep(4)
                fetchDocuments() // Refresh main list
            } catch (err) {
                console.error('Sync failed:', err)
                alert('Sync failed. Check console.')
            } finally {
                setIsSyncing(false)
            }
        }
    }

    const handleResetSync = () => {
        setShowSyncModal(false)
        setSyncStep(1)
        setSelectedSource('')
        setSelectedProject('')
        setSyncResult(null)
        setDocsToSync([])
        setSelectedDocIds(new Set())
        setSyncStatus({})
    }
    
    const toggleDocSelection = (docId: string) => {
        const newSelected = new Set(selectedDocIds)
        if (newSelected.has(docId)) {
            newSelected.delete(docId)
        } else {
            newSelected.add(docId)
        }
        setSelectedDocIds(newSelected)
    }
    
    const toggleSelectAll = () => {
        if (selectedDocIds.size === docsToSync.length) {
            // Deselect all
            setSelectedDocIds(new Set())
        } else {
            // Select all
            const allIds = docsToSync.map(doc => doc.uuid || doc.id)
            setSelectedDocIds(new Set(allIds))
        }
    }

    // Filter Logic
    const filteredDocs = documents.filter(doc => {
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
                    <AIAgentsDropdown onAgentSelect={onAgentSelect} />
                </div>
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
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading documents...</div>
                ) : (
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
                                        {doc.webUrl ? (
                                            <a href={doc.webUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                {doc.name}
                                            </a>
                                        ) : (
                                            <span>{doc.name}</span>
                                        )}
                                    </td>
                                    <td>{doc.updatedBy}</td>
                                    <td>{doc.updatedOn}</td>
                                    <td>{doc.project}</td>
                                </tr>
                            ))}
                            {filteredDocs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-400">
                                        No documents found. Try adjusting filters or syncing a source.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Sync Modal */}
            {showSyncModal && (
                <div className="settings-modal-overlay" onClick={() => setShowSyncModal(false)}>
                    <div className="settings-modal sync-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header">
                            <div>
                                <h3 className="settings-modal-title">Sync From Source</h3>
                                <p className="settings-modal-desc">Step {syncStep} of 3: {
                                    syncStep === 1 ? 'Select Source' :
                                        syncStep === 2 ? 'Select Project' :
                                            syncStep === 3 ? 'Confirm Sync' : 'Complete'
                                }</p>
                            </div>
                            <button className="settings-modal-close" onClick={() => setShowSyncModal(false)}>×</button>
                        </div>

                        <div className="settings-modal-body">
                            {syncStep === 1 && (
                                <div className="settings-form-group">
                                    <label>Select Source</label>
                                    <select
                                        value={selectedSource}
                                        onChange={e => setSelectedSource(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="">-- Choose a source --</option>
                                        {sources.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                        ))}
                                    </select>
                                    {sources.length === 0 && (
                                        <p className="text-sm text-gray-500 mt-2">No sources configured. Go to Settings to add one.</p>
                                    )}
                                </div>
                            )}

                            {syncStep === 2 && (
                                <div className="settings-form-group">
                                    <label>Select Project</label>
                                    {projects.length === 0 ? (
                                        <p>Loading projects...</p>
                                    ) : (
                                        <select
                                            value={selectedProject}
                                            onChange={e => setSelectedProject(e.target.value)}
                                            className="w-full p-2 border rounded-lg"
                                        >
                                            <option value="">-- Choose a project --</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {syncStep === 3 && (
                                <div>
                                    {isSyncing ? (
                                        <div className="text-center p-4">
                                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                                            <p>Fetching documents...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-4 flex justify-between items-center">
                                                <p>Found <strong>{docsToSync.length}</strong> documents in this project.</p>
                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDocIds.size === docsToSync.length && docsToSync.length > 0}
                                                        onChange={toggleSelectAll}
                                                        className="cursor-pointer"
                                                    />
                                                    <span>Select All</span>
                                                </label>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                                                {docsToSync.map(doc => {
                                                    const docId = doc.uuid || doc.id
                                                    const typeCode = doc.documentTypeCode || doc.documentType || doc.type
                                                    const typeName = documentTypeNames[typeCode] || typeCode || 'Document'
                                                    const isSelected = selectedDocIds.has(docId)
                                                    const isSynced = syncStatus[docId]
                                                    
                                                    return (
                                                        <div 
                                                            key={docId} 
                                                            className="text-sm py-2 px-2 border-b last:border-0 flex items-center gap-3 hover:bg-gray-100 cursor-pointer"
                                                            onClick={() => toggleDocSelection(docId)}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleDocSelection(docId)}
                                                                className="cursor-pointer"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <div className="flex-1 flex justify-between items-center">
                                                                <span className="flex-1">{doc.title || doc.name}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-500 text-xs">{typeName}</span>
                                                                    {isSynced && (
                                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                            Synced
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <p className="mt-4 text-sm text-gray-600">
                                                Selected <strong>{selectedDocIds.size}</strong> document(s). 
                                                {selectedDocIds.size > 0 && Object.values(syncStatus).filter(Boolean).length > 0 && (
                                                    <span className="ml-2 text-blue-600">
                                                        Existing documents will be updated.
                                                    </span>
                                                )}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {syncStep === 4 && (
                                <div className="text-center p-8">
                                    <div className="text-green-500 text-4xl mb-4">✓</div>
                                    <h3 className="text-xl font-bold mb-2">Sync Complete!</h3>
                                    <p className="mb-4">{syncResult?.message}</p>
                                    {syncResult && (
                                        <div className="text-sm text-gray-600 space-y-1">
                                            {syncResult.added > 0 && (
                                                <p className="text-green-600">✓ {syncResult.added} document(s) newly added</p>
                                            )}
                                            {syncResult.updated > 0 && (
                                                <p className="text-blue-600">↻ {syncResult.updated} document(s) updated</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="settings-modal-footer">
                            {syncStep < 4 && (
                                <button className="btn btn-secondary" onClick={() => {
                                    if (syncStep > 1) setSyncStep(syncStep - 1)
                                    else setShowSyncModal(false)
                                }}>Back</button>
                            )}

                            {syncStep < 3 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSyncNext}
                                    disabled={
                                        (syncStep === 1 && !selectedSource) ||
                                        (syncStep === 2 && !selectedProject)
                                    }
                                >
                                    Next
                                </button>
                            )}

                            {syncStep === 3 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSyncNext}
                                    disabled={isSyncing}
                                >
                                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                                </button>
                            )}

                            {syncStep === 4 && (
                                <button className="btn btn-primary" onClick={handleResetSync}>Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
