'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface AddDocumentModalProps {
    onClose: () => void
    onSyncComplete: () => void
}

interface DocumentInfo {
    name: string
    type: string
    size: string
    chunks: number
    uploadDate: string
}

interface Source {
    id: string
    name: string
    type: string
    config?: any
}

// Mock Data Types
interface Project { id: string; name: string }

export default function AddDocumentModal({ onClose, onSyncComplete }: AddDocumentModalProps) {
    const [uploading, setUploading] = useState(false)
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('local')

    // Ingestion Filters
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState('')
    const [selectedDocType, setSelectedDocType] = useState('All')

    // Staging Area State
    const [stagingDocs, setStagingDocs] = useState<DocumentInfo[]>([])
    const [selectedStagingDocs, setSelectedStagingDocs] = useState<string[]>([])
    const [isFetchingStaging, setIsFetchingStaging] = useState(false)

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

        // Mock Fetching Projects for CALM
        const source = sources.find(s => s.id === sourceId)
        if (source && source.type === 'CALM') {
            // Simulate API call to list projects
            setProjects([
                { id: 'proj-1', name: 'S/4HANA Implementation Wave 2' },
                { id: 'proj-2', name: 'Finance Transformation' }
            ])
        } else {
            setProjects([])
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
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Mock data filtered by Type
            let newDocs = [
                { name: 'S4HANA_Finance_Spec.pdf', type: 'PDF', size: '2.4 MB', chunks: 0, uploadDate: new Date().toISOString() },
                { name: 'O2C_Process_Flow.docx', type: 'Word', size: '1.1 MB', chunks: 0, uploadDate: new Date().toISOString() },
                { name: 'Inventory_API_Config.txt', type: 'Text', size: '45 KB', chunks: 0, uploadDate: new Date().toISOString() },
                { name: 'Legacy_Code_Export.java', type: 'Code', size: '120 KB', chunks: 0, uploadDate: new Date().toISOString() },
                { name: 'Custom_Report_ZREP.abap', type: 'ABAP', size: '15 KB', chunks: 0, uploadDate: new Date().toISOString() }
            ]

            if (selectedDocType !== 'All') {
                newDocs = newDocs.filter(d => d.type === selectedDocType)
            }
            // If project is selected, we assume backend filters by project. 
            // For UI feedback, we just show the docs.

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
            await new Promise(resolve => setTimeout(resolve, 1500))
            alert(`Synced ${selectedStagingDocs.length} documents to Knowledge Base!`)
            onSyncComplete()
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
                                    {/* Project Selector (for CALM) */}
                                    {projects.length > 0 && (
                                        <div className="input-group">
                                            <label className="input-label">Project</label>
                                            <select
                                                className="input select"
                                                value={selectedProject}
                                                onChange={e => setSelectedProject(e.target.value)}
                                            >
                                                <option value="">Select Project</option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Document Type Selector */}
                                    <div className="input-group">
                                        <label className="input-label">Document Type</label>
                                        <select
                                            className="input select"
                                            value={selectedDocType}
                                            onChange={e => setSelectedDocType(e.target.value)}
                                        >
                                            <option value="All">All Types</option>
                                            <option value="PDF">PDF</option>
                                            <option value="Word">Word</option>
                                            <option value="Text">Text</option>
                                            <option value="Code">Code</option>
                                            <option value="ABAP">ABAP</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary w-full"
                                    onClick={handleLoadFromSource}
                                    disabled={isFetchingStaging || uploading || (projects.length > 0 && !selectedProject)}
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
