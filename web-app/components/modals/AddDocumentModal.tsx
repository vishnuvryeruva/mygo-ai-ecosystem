'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface AddDocumentModalProps {
    onClose: () => void
    onSyncComplete: (newDocs?: DocumentInfo[]) => void
}

interface DocumentInfo {
    name: string
    type: string
    size: string
    chunks: number
    uploadDate: string
    // Additional fields for synced documents
    source?: string
    updatedBy?: string
    project?: string
    scope?: string
}

interface Source {
    id: string
    name: string
    type: string
    config?: any
}

// Mock Data Types
interface Project { id: string; name: string }
interface Scope { id: string; name: string }

export default function AddDocumentModal({ onClose, onSyncComplete }: AddDocumentModalProps) {
    const [uploading, setUploading] = useState(false)
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('local')

    // Ingestion Filters
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState('')
    const [scopes, setScopes] = useState<Scope[]>([])
    const [selectedScope, setSelectedScope] = useState('')

    // Staging Area State
    const [stagingDocs, setStagingDocs] = useState<DocumentInfo[]>([])
    const [selectedStagingDocs, setSelectedStagingDocs] = useState<string[]>([])
    const [isFetchingStaging, setIsFetchingStaging] = useState(false)

    // Demo data indicator
    const [isUsingDemoData, setIsUsingDemoData] = useState(false)
    const [demoError, setDemoError] = useState<string | null>(null)
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)

    useEffect(() => {
        fetchSources()
    }, [])

    const fetchSources = async () => {
        try {
            const response = await axios.get('/api/sources')
            setSources(response.data.sources || [])
        } catch (error) {
            console.error('Error fetching sources:', error)
            setSources([
                { id: 'src-1', name: 'Mygo Cloud ALM', type: 'CALM' }
            ])
        }
    }

    const handleSourceChange = async (sourceId: string) => {
        setSelectedSourceId(sourceId)
        setStagingDocs([])
        setSelectedStagingDocs([])
        setSelectedProject('')
        setScopes([])
        setSelectedScope('')
        setIsUsingDemoData(false)
        setDemoError(null)
        setProjects([])

        // Fetch real projects from CALM API
        const source = sources.find(s => s.id === sourceId)
        if (source && source.type === 'CALM') {
            setIsLoadingProjects(true)
            try {
                const response = await axios.get(`/api/calm/${sourceId}/projects`)
                setProjects(response.data.projects || [])

                // Check if using demo data
                if (response.data.isDemo) {
                    setIsUsingDemoData(true)
                    setDemoError(response.data.error || 'Could not connect to Cloud ALM API')
                }
            } catch (error) {
                console.error('Error fetching projects:', error)
                setProjects([])
            } finally {
                setIsLoadingProjects(false)
            }
        } else {
            setProjects([])
            setScopes([])
        }
    }

    const handleProjectChange = async (projectId: string) => {
        setSelectedProject(projectId)
        setSelectedScope('')
        setScopes([])
        setStagingDocs([])
        setSelectedStagingDocs([])

        if (projectId && selectedSourceId !== 'local') {
            try {
                const response = await axios.get(`/api/calm/${selectedSourceId}/scopes?projectId=${projectId}`)
                setScopes(response.data.scopes || [])
            } catch (error) {
                console.error('Error fetching scopes:', error)
                setScopes([])
            }
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setUploading(true)
        setTimeout(() => {
            alert('Documents uploaded successfully!')
            setUploading(false)
            onSyncComplete()
            onClose()
        }, 1500)
    }

    const handleLoadFromSource = async () => {
        if (selectedSourceId === 'local') return
        const source = sources.find(s => s.id === selectedSourceId)
        if (!source) return

        setIsFetchingStaging(true)
        setStagingDocs([])
        try {
            // Build query params
            const params = new URLSearchParams()
            if (selectedProject) params.append('projectId', selectedProject)
            if (selectedScope) params.append('scopeId', selectedScope)

            const response = await axios.get(`/api/calm/${selectedSourceId}/documents?${params.toString()}`)
            const docs = response.data.documents || []

            // Map API response to our DocumentInfo format
            const newDocs = docs.map((doc: any) => ({
                id: doc.id,
                name: doc.name,
                type: doc.type || 'Document',
                size: doc.size || 'Unknown',
                chunks: 0,
                uploadDate: doc.lastUpdated || new Date().toISOString(),
                // Store additional metadata for sync
                projectId: selectedProject,
                projectName: projects.find(p => p.id === selectedProject)?.name || '',
                scopeId: selectedScope,
                scopeName: scopes.find(s => s.id === selectedScope)?.name || '',
                source: source.type
            }))

            setStagingDocs(newDocs)
        } catch (error) {
            console.error('Error loading from source:', error)
            alert('Failed to fetch documents from source.')
        } finally {
            setIsFetchingStaging(false)
        }
    }

    const handleToggleStagingDoc = (docName: string) => {
        if (selectedStagingDocs.includes(docName)) {
            setSelectedStagingDocs(selectedStagingDocs.filter(id => id !== docName))
        } else {
            setSelectedStagingDocs([...selectedStagingDocs, docName])
        }
    }

    const handleSyncSelected = async () => {
        if (selectedStagingDocs.length === 0) return
        setUploading(true)
        try {
            const source = sources.find(s => s.id === selectedSourceId)

            // Get full document objects for selected docs
            const docsToSync = stagingDocs
                .filter(doc => selectedStagingDocs.includes(doc.name))
                .map(doc => ({
                    id: (doc as any).id,
                    name: doc.name,
                    type: doc.type,
                    size: doc.size,
                    source: source?.type || 'Unknown',
                    project: (doc as any).projectName || '',
                    updatedBy: 'System',
                    uploadDate: doc.uploadDate
                }))

            await axios.post('/api/sync', {
                sourceId: selectedSourceId,
                documents: docsToSync
            })

            // Pass synced docs back to parent
            onSyncComplete(docsToSync as any)
            onClose()
        } catch (error) {
            console.error('Error syncing documents:', error)
            alert('Sync failed.')
        } finally {
            setUploading(false)
        }
    }

    const getDocIcon = (type: string) => {
        const icons: Record<string, string> = {
            'PDF': '📄',
            'Word': '📝',
            'Text': '📃',
            'Code': '💻',
            'Python': '🐍',
            'JavaScript': '📜',
            'ABAP': '💠'
        }
        return icons[type] || '📁'
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal w-[800px] max-w-full" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Add / Sync Documents</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body max-h-[70vh] overflow-y-auto">
                    {/* Demo Data Warning */}
                    {isUsingDemoData && (
                        <div className="mb-4 p-3 rounded-lg" style={{
                            backgroundColor: 'rgba(255, 166, 0, 0.15)',
                            border: '1px solid rgba(255, 166, 0, 0.5)',
                            color: '#ffa600'
                        }}>
                            <div className="flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <div>
                                    <strong>Using Demo Data</strong>
                                    <p className="text-sm mt-1 opacity-80">
                                        Could not connect to Cloud ALM API. Showing sample data for demonstration.
                                        {demoError && <span className="block mt-1 text-xs opacity-60">Error: {demoError}</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Source Selector */}
                    <div className="input-group mb-6">
                        <label className="input-label">Source</label>
                        <select
                            className="input select"
                            value={selectedSourceId}
                            onChange={(e) => handleSourceChange(e.target.value)}
                        >
                            <option value="local">📂 Local Upload</option>
                            <optgroup label="Saved Sources">
                                {sources.map(source => (
                                    <option key={source.id} value={source.id}>
                                        {source.type === 'CALM' ? '☁️' : '🔌'} {source.name}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {selectedSourceId === 'local' ? (
                        <div className="glass-subtle p-8 text-center border-2 border-dashed border-[var(--glass-border)] hover:border-indigo-500/50 transition-colors cursor-pointer rounded-xl">
                            <input
                                type="file"
                                multiple
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="hidden"
                                id="file-upload-modal"
                            />
                            <label htmlFor="file-upload-modal" className="cursor-pointer block">
                                <div className="text-4xl mb-3">📤</div>
                                <p className="text-heading font-medium">Click or Drag files</p>
                                <p className="text-xs text-muted mt-2">PDF, DOCX, TXT, ZIP</p>
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="glass-subtle p-4 rounded-xl">
                                <h4 className="text-sm font-semibold text-heading mb-4">Ingestion Configuration</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    {/* Project Selector */}
                                    <div className="input-group">
                                        <label className="input-label">Project</label>
                                        <select
                                            className="input select"
                                            value={selectedProject}
                                            onChange={e => handleProjectChange(e.target.value)}
                                            disabled={isLoadingProjects}
                                        >
                                            {isLoadingProjects ? (
                                                <option value="">Loading projects...</option>
                                            ) : projects.length === 0 ? (
                                                <option value="">No projects available</option>
                                            ) : (
                                                <>
                                                    <option value="">Select Project</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Scope Selector */}
                                    <div className="input-group">
                                        <label className="input-label">Scope</label>
                                        <select
                                            className="input select"
                                            value={selectedScope}
                                            onChange={e => setSelectedScope(e.target.value)}
                                            disabled={!selectedProject || scopes.length === 0}
                                        >
                                            {!selectedProject ? (
                                                <option value="">Select a project first</option>
                                            ) : scopes.length === 0 ? (
                                                <option value="">Loading scopes...</option>
                                            ) : (
                                                <>
                                                    <option value="">Select Scope</option>
                                                    {scopes.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary w-full"
                                    onClick={handleLoadFromSource}
                                    disabled={isFetchingStaging || uploading || !selectedProject || !selectedScope}
                                >
                                    {isFetchingStaging ? (
                                        <span className="flex items-center gap-2 justify-center">
                                            <span className="spinner w-4 h-4" /> Fetching Docs...
                                        </span>
                                    ) : (
                                        '🔄 Get Documents'
                                    )}
                                </button>
                            </div>

                            {/* Staging Area */}
                            {stagingDocs.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-top-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-semibold text-heading">Available Documents ({stagingDocs.length})</h4>
                                        <button
                                            className="text-xs text-indigo-400 hover:text-indigo-300"
                                            onClick={() => setSelectedStagingDocs(stagingDocs.map(d => d.name))}
                                        >
                                            Select All
                                        </button>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-2 custom-scrollbar bg-white/5 rounded-xl p-2">
                                        {stagingDocs.map((doc, i) => (
                                            <label key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/10 transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1"
                                                    checked={selectedStagingDocs.includes(doc.name)}
                                                    onChange={() => handleToggleStagingDoc(doc.name)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span>{getDocIcon(doc.type)}</span>
                                                        <div className="truncate font-medium text-sm text-heading" title={doc.name}>{doc.name}</div>
                                                    </div>
                                                    <div className="text-xs text-muted mt-0.5">{doc.type} • {doc.size}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <button
                                        className="btn btn-success w-full"
                                        onClick={handleSyncSelected}
                                        disabled={selectedStagingDocs.length === 0 || uploading}
                                    >
                                        {uploading ? (
                                            <span className="flex items-center gap-2 justify-center">
                                                <span className="spinner w-4 h-4" /> Syncing...
                                            </span>
                                        ) : (
                                            `Sync Selected (${selectedStagingDocs.length})`
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
