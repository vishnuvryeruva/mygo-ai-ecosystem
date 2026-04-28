'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AppModal from './AppModal'

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

interface SyncSourceModalProps {
    isOpen: boolean
    onClose: () => void
    onSyncComplete?: () => void
    preSelectedSourceId?: string | null
}

const isCloudAlmSource = (source: Source) => {
    const sourceType = String(source?.type || '').trim().toUpperCase()
    return sourceType === 'CALM' || sourceType === 'SAP CLOUD ALM'
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

export default function SyncSourceModal({ isOpen, onClose, onSyncComplete, preSelectedSourceId }: SyncSourceModalProps) {
    const [syncStep, setSyncStep] = useState(1) // 1: Source, 2: Project, 3: Fetching/Confirm, 4: Result
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSource, setSelectedSource] = useState('')
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState('')
    const [docsToSync, setDocsToSync] = useState<any[]>([])
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
    const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({})
    const [isSyncing, setIsSyncing] = useState(false)
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
    const [syncResult, setSyncResult] = useState<{ message: string; count: number; updated: number; added: number } | null>(null)

    useEffect(() => {
        if (isOpen) {
            fetchSources()
        } else {
            handleResetSync()
        }
    }, [isOpen])

    // Pre-select source if provided
    useEffect(() => {
        if (preSelectedSourceId && sources.length > 0) {
            setSelectedSource(preSelectedSourceId)
            // Automatically advance to step 2 if source is pre-selected
            setSyncStep(2)
        }
    }, [preSelectedSourceId, sources])

    useEffect(() => {
        if (selectedSource && syncStep === 2) {
            fetchProjects(selectedSource)
        }
    }, [selectedSource, syncStep])

    const fetchSources = async () => {
        try {
            const res = await axios.get('/api/sources')
            const calmSources = (res.data.sources || []).filter(isCloudAlmSource)
            setSources(calmSources)
            if (calmSources.length === 0) {
                setSelectedSource('')
            }
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        }
    }

    const fetchProjects = async (sourceId: string) => {
        setProjects([]) // Clear previous
        setProjectLoadError(null)
        setIsLoadingProjects(true)
        try {
            const res = await axios.get(`/api/calm/${sourceId}/projects`)
            setProjects(res.data.projects || [])
        } catch (err: any) {
            console.error('Failed to fetch projects:', err)
            setProjects([])
            setProjectLoadError(err?.response?.data?.error || 'Failed to load projects.')
        } finally {
            setIsLoadingProjects(false)
        }
    }

    const handleSyncNext = async () => {
        if (syncStep === 1 && selectedSource) {
            setSyncStep(2)
        } else if (syncStep === 2 && selectedProject) {
            setSyncStep(3)
            // Fetch potential docs and test cases to sync
            setIsSyncing(true)
            try {
                const res = await axios.get(`/api/calm/${selectedSource}/documents?projectId=${selectedProject}&includeTestCases=true`)
                const docs = res.data.documents || []
                const testCases = res.data.testCases || []

                // Combine documents and test cases
                const allItems = [...docs, ...testCases]
                setDocsToSync(allItems)

                // Check sync status for all items
                const itemIds = allItems.map((item: any) => item.uuid || item.id)
                const statusRes = await axios.post('/api/sync/check', {
                    documentIds: itemIds
                })
                setSyncStatus(statusRes.data.syncStatus || {})

                // Select all items by default
                setSelectedDocIds(new Set(itemIds))
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

                const res = await axios.post('/api/sync', {
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
                if (onSyncComplete) onSyncComplete()
            } catch (err) {
                console.error('Sync failed:', err)
                alert('Sync failed. Check console.')
            } finally {
                setIsSyncing(false)
            }
        }
    }

    const handleResetSync = () => {
        setSyncStep(1)
        setSelectedSource('')
        setSelectedProject('')
        setProjects([])
        setIsLoadingProjects(false)
        setProjectLoadError(null)
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

    if (!isOpen) return null

    return (
        <AppModal onClose={onClose}>
            <div>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Sync From Source</h3>
                        <p className="text-sm text-muted mt-1">Step {syncStep} of 3: {
                            syncStep === 1 ? 'Select Source' :
                                syncStep === 2 ? 'Select Project' :
                                    syncStep === 3 ? 'Confirm Sync' : 'Complete'
                        }</p>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
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
                            {isLoadingProjects ? (
                                <p>Loading projects...</p>
                            ) : projectLoadError ? (
                                <div>
                                    <p className="text-sm text-red-600 mb-2">Failed to load projects.</p>
                                    <p className="text-xs text-red-500">{projectLoadError}</p>
                                </div>
                            ) : projects.length === 0 ? (
                                <p className="text-sm text-gray-500">No projects found for this source.</p>
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
                                            const isTestCase = doc.itemType === 'test_case'
                                            const typeCode = doc.documentTypeCode || doc.documentType || doc.type
                                            const typeName = isTestCase ? 'Test Case' : (documentTypeNames[typeCode] || typeCode || 'Document')
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
                                                    {isTestCase ? (
                                                        <span className="text-lg" title="Test Case">🧪</span>
                                                    ) : (
                                                        <span className="text-lg" title="Document">📄</span>
                                                    )}
                                                    <div className="flex-1 flex justify-between items-center">
                                                        <span className="flex-1">{doc.title || doc.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`text-xs px-2 py-1 rounded ${isTestCase
                                                                        ? 'bg-purple-100 text-purple-700'
                                                                        : 'bg-blue-100 text-blue-700'
                                                                    }`}
                                                            >
                                                                {typeName}
                                                            </span>
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
                                        Selected <strong>{selectedDocIds.size}</strong> item(s)
                                        ({docsToSync.filter(d => selectedDocIds.has(d.uuid || d.id) && d.itemType === 'document').length} document(s),
                                        {docsToSync.filter(d => selectedDocIds.has(d.uuid || d.id) && d.itemType === 'test_case').length} test case(s)).
                                        {selectedDocIds.size > 0 && Object.values(syncStatus).filter(Boolean).length > 0 && (
                                            <span className="ml-2 text-blue-600">
                                                Existing items will be updated.
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

                <div className="modal-footer">
                    {syncStep < 4 && (
                        <button className="btn btn-secondary" onClick={() => {
                            if (syncStep > 1) setSyncStep(syncStep - 1)
                            else onClose()
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
                        <button className="btn btn-primary" onClick={onClose}>Close</button>
                    )}
                </div>
            </div>
        </AppModal>
    )
}
