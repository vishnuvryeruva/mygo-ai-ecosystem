'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AppModal from './AppModal'

interface FileUploadModalProps {
    onClose: () => void
    onUploadComplete?: () => void
}

interface Source {
    id: string
    name: string
    type: string
}

interface Project {
    id: string
    name: string
}

export default function FileUploadModal({ onClose, onUploadComplete }: FileUploadModalProps) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadDestination, setUploadDestination] = useState<'dms' | 'alm' | 'both'>('dms')
    const [uploadProgress, setUploadProgress] = useState<string>('')
    
    // Cloud ALM configuration
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')
    const [loadingSources, setLoadingSources] = useState(false)
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    // Fetch sources when Cloud ALM upload is selected
    useEffect(() => {
        if (uploadDestination === 'alm' || uploadDestination === 'both') {
            fetchSources()
        }
    }, [uploadDestination])

    // Fetch projects when source is selected
    useEffect(() => {
        if (selectedSourceId) {
            fetchProjects(selectedSourceId)
        }
    }, [selectedSourceId])

    const fetchSources = async () => {
        setLoadingSources(true)
        try {
            const res = await axios.get('/api/sources')
            const sourcesData = res.data.sources || []
            setSources(sourcesData)
            if (sourcesData.length > 0) {
                setSelectedSourceId(sourcesData[0].id)
            }
        } catch (error) {
            console.error('Error fetching sources:', error)
            alert('Failed to load sources. Please check your connection settings.')
        } finally {
            setLoadingSources(false)
        }
    }

    const fetchProjects = async (sourceId: string) => {
        setLoadingProjects(true)
        try {
            const res = await axios.get(`/api/calm/${sourceId}/projects`)
            const projectsData = res.data.projects || []
            setProjects(projectsData)
            if (projectsData.length > 0) {
                setSelectedProjectId(projectsData[0].id)
            }
        } catch (error) {
            console.error('Error fetching projects:', error)
            alert('Failed to load projects for this source.')
        } finally {
            setLoadingProjects(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return
        setSelectedFiles(Array.from(files))
    }

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            alert('Please select at least one file to upload')
            return
        }

        if ((uploadDestination === 'alm' || uploadDestination === 'both') && (!selectedSourceId || !selectedProjectId)) {
            alert('Please select a source and project for Cloud ALM upload')
            return
        }

        setUploading(true)
        setUploadProgress('Preparing files...')

        try {
            const errors: string[] = []

            if (uploadDestination === 'dms' || uploadDestination === 'both') {
                const formData = new FormData()
                selectedFiles.forEach(file => {
                    formData.append('files', file)
                })

                setUploadProgress('Uploading to DMS...')
                try {
                    await axios.post('/api/upload-documents', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    })
                } catch (dmsError: any) {
                    errors.push(dmsError?.response?.data?.error || 'Failed to upload to DMS.')
                }
            }

            if (uploadDestination === 'alm' || uploadDestination === 'both') {
                setUploadProgress('Syncing to Cloud ALM...')
                try {
                    for (const file of selectedFiles) {
                        const fileContent = await file.text()
                        await axios.post(`/api/calm/${selectedSourceId}/push-spec`, {
                            name: file.name,
                            content: fileContent,
                            projectId: selectedProjectId,
                            documentType: 'SD',
                            processId: ''
                        })
                    }
                } catch (almError: any) {
                    console.error('Error syncing to Cloud ALM:', almError)
                    errors.push(almError?.response?.data?.error || 'Failed to sync to Cloud ALM.')
                }
            }

            if (errors.length > 0) {
                alert(errors.join(' '))
            }

            setUploadProgress('')
            const destLabel =
                uploadDestination === 'dms' ? 'DMS (Document Hub)' :
                uploadDestination === 'alm' ? 'Cloud ALM' :
                'DMS and Cloud ALM'
            setSuccessMessage(`Successfully uploaded ${selectedFiles.length} document(s) to ${destLabel}.`)
            setShowSuccessDialog(true)
            setSelectedFiles([])
            setUploadDestination('dms')
            setSelectedSourceId('')
            setSelectedProjectId('')
        } catch (error: any) {
            console.error('Error uploading documents:', error)
            const errorMsg = error?.response?.data?.error || 'Failed to upload documents. Please try again.'
            alert(errorMsg)
            setUploadProgress('')
        } finally {
            setUploading(false)
        }
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'pdf': return '📄'
            case 'doc':
            case 'docx': return '📝'
            case 'txt': return '📃'
            case 'zip': return '📦'
            case 'py': return '🐍'
            case 'js':
            case 'ts': return '📜'
            default: return '📁'
        }
    }

    return (
        <AppModal onClose={onClose}>
            <div>
                <div className="modal-header">
                    <h2 className="modal-title flex items-center gap-2">
                        <span className="text-2xl">📤</span>
                        Upload Documents
                    </h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="modal-body">
                    {/* File Upload Area */}
                    <div className="mb-6">
                        <label className="input-label">Select Files from Your Computer</label>
                        <p className="text-sm text-muted mb-4">
                            Upload PDF, DOCX, TXT files, or a ZIP archive containing project files.
                        </p>
                        <div className="glass-subtle p-6 text-center border-2 border-dashed border-[var(--glass-border)] hover:border-indigo-500/50 transition-colors cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.docx,.txt,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="hidden"
                                id="file-upload-input"
                            />
                            <label htmlFor="file-upload-input" className="cursor-pointer">
                                <div className="text-4xl mb-3">📂</div>
                                <p className="text-heading font-medium">Click to browse files</p>
                                <p className="text-sm text-muted mt-1">PDF, DOCX, TXT, ZIP</p>
                            </label>
                        </div>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="mb-6">
                            <label className="input-label">Selected Files ({selectedFiles.length})</label>
                            <div className="glass-subtle p-4 max-h-64 overflow-y-auto">
                                {selectedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 px-3 mb-2 bg-[var(--glass-bg)] rounded-lg border border-[var(--glass-border)]">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-2xl">{getFileIcon(file.name)}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-heading font-medium truncate">{file.name}</p>
                                                <p className="text-sm text-muted">{formatFileSize(file.size)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFile(index)}
                                            disabled={uploading}
                                            className="btn btn-ghost text-red-400 hover:text-red-300 text-sm ml-2"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload destination */}
                    <div className="glass-subtle p-4 mb-6">
                        <p className="text-heading font-medium mb-3">Upload destination</p>
                        <div className="space-y-2">
                            {([
                                { value: 'dms' as const, label: 'DMS (Document Hub)', description: 'Store in your knowledge base for AI search' },
                                { value: 'alm' as const, label: 'Cloud ALM', description: 'Push documents to your connected Cloud ALM project' },
                                { value: 'both' as const, label: 'Both', description: 'Upload to Document Hub and Cloud ALM' },
                            ]).map(option => (
                                <label key={option.value} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                                    <input
                                        type="radio"
                                        name="upload-destination"
                                        value={option.value}
                                        checked={uploadDestination === option.value}
                                        onChange={() => setUploadDestination(option.value)}
                                        disabled={uploading}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-heading font-medium">{option.label}</p>
                                        <p className="text-sm text-muted mt-0.5">{option.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {(uploadDestination === 'alm' || uploadDestination === 'both') && (
                            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] space-y-4">
                                {loadingSources ? (
                                    <div className="flex items-center gap-2 text-sm text-muted">
                                        <div className="spinner w-4 h-4" />
                                        <span>Loading sources...</span>
                                    </div>
                                ) : sources.length === 0 ? (
                                    <p className="text-sm text-red-400">
                                        No Cloud ALM sources configured. Please add a source in Settings first.
                                    </p>
                                ) : (
                                    <>
                                        <div>
                                            <label className="input-label text-sm">Select Cloud ALM Source</label>
                                            <select
                                                value={selectedSourceId}
                                                onChange={(e) => setSelectedSourceId(e.target.value)}
                                                disabled={uploading}
                                                className="input-field w-full"
                                            >
                                                {sources.map(source => (
                                                    <option key={source.id} value={source.id}>
                                                        {source.name} ({source.type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {loadingProjects ? (
                                            <div className="flex items-center gap-2 text-sm text-muted">
                                                <div className="spinner w-4 h-4" />
                                                <span>Loading projects...</span>
                                            </div>
                                        ) : projects.length === 0 ? (
                                            <p className="text-sm text-yellow-400">
                                                No projects found for this source.
                                            </p>
                                        ) : (
                                            <div>
                                                <label className="input-label text-sm">Select Project</label>
                                                <select
                                                    value={selectedProjectId}
                                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                                    disabled={uploading}
                                                    className="input-field w-full"
                                                >
                                                    {projects.map(project => (
                                                        <option key={project.id} value={project.id}>
                                                            {project.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Upload Progress */}
                    {uploading && uploadProgress && (
                        <div className="glass-subtle p-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="spinner w-5 h-5" />
                                <p className="text-indigo-400">{uploadProgress}</p>
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="glass-subtle p-4">
                        <h4 className="font-medium text-indigo-300 mb-2">ℹ️ How it works</h4>
                        <ul className="text-sm text-muted space-y-1">
                            <li>• DMS uploads store documents in Document Hub for AI-powered search</li>
                            <li>• Cloud ALM uploads push documents to your connected SAP Cloud ALM project</li>
                            <li>• Choose &quot;Both&quot; to keep documents in Document Hub and sync them to Cloud ALM</li>
                        </ul>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        className="btn btn-primary"
                        disabled={uploading || selectedFiles.length === 0}
                    >
                        {uploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                    </button>
                </div>
            </div>

            {/* Success Dialog */}
            {showSuccessDialog && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110]" onClick={() => { setShowSuccessDialog(false); if (onUploadComplete) onUploadComplete(); onClose() }}>
                    <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title flex items-center gap-2">
                                <span className="text-2xl text-green-400">✓</span>
                                Upload complete
                            </h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-main">{successMessage}</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowSuccessDialog(false)
                                    if (onUploadComplete) onUploadComplete()
                                    onClose()
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppModal>
    )
}
