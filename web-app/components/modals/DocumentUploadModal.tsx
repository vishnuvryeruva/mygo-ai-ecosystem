'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface DocumentUploadModalProps {
    onClose: () => void
}

interface DocumentInfo {
    name: string
    type: string
    size: string
    chunks: number
    uploadDate: string
}

export default function DocumentUploadModal({ onClose }: DocumentUploadModalProps) {
    const [uploading, setUploading] = useState(false)
    const [loadingDocs, setLoadingDocs] = useState(true)
    const [documents, setDocuments] = useState<DocumentInfo[]>([])
    const [showDocs, setShowDocs] = useState(true)
    const [duplicateDialog, setDuplicateDialog] = useState<{
        show: boolean
        filename: string
        file: File | null
    }>({ show: false, filename: '', file: null })

    // Fetch documents on mount
    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        setLoadingDocs(true)
        try {
            const response = await axios.get('/api/documents')
            setDocuments(response.data.documents)
        } catch (error) {
            console.error('Error fetching documents:', error)
        } finally {
            setLoadingDocs(false)
        }
    }

    const checkDuplicate = async (filename: string): Promise<boolean> => {
        try {
            const response = await axios.get(`/api/check-duplicate/${encodeURIComponent(filename)}`)
            return response.data.is_duplicate
        } catch (error) {
            console.error('Error checking duplicate:', error)
            return false
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)

        // Check for duplicates
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const isDuplicate = await checkDuplicate(file.name)

            if (isDuplicate) {
                // Show duplicate dialog
                setDuplicateDialog({
                    show: true,
                    filename: file.name,
                    file: file
                })
                setUploading(false)
                return
            }
        }

        // If no duplicates, proceed with upload
        await uploadFiles(files)
    }

    const uploadFiles = async (files: FileList) => {
        const formData = new FormData()
        Array.from(files).forEach(file => {
            formData.append('files', file)
        })

        try {
            await axios.post('/api/upload-documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            alert('Documents uploaded successfully!')
            fetchDocuments()
        } catch (error) {
            console.error('Error uploading documents:', error)
            alert('Error uploading documents. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    const handleDuplicateOverwrite = async () => {
        if (!duplicateDialog.file) return

        // Delete existing document first
        try {
            await axios.delete(`/api/documents/${encodeURIComponent(duplicateDialog.filename)}`)

            // Then upload the new file
            const files = [duplicateDialog.file]
            const fileList = {
                length: files.length,
                item: (index: number) => files[index],
                [Symbol.iterator]: function* () {
                    for (let i = 0; i < files.length; i++) {
                        yield files[i]
                    }
                }
            } as unknown as FileList

            await uploadFiles(fileList)
        } catch (error) {
            console.error('Error overwriting document:', error)
            alert('Error overwriting document')
        }

        setDuplicateDialog({ show: false, filename: '', file: null })
    }

    const handleDuplicateSkip = () => {
        setDuplicateDialog({ show: false, filename: '', file: null })
        setUploading(false)
    }

    const handleDeleteDocument = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return

        try {
            await axios.delete(`/api/documents/${encodeURIComponent(filename)}`)
            setDocuments(documents.filter(d => d.name !== filename))
            alert('Document deleted successfully')
        } catch (error) {
            console.error('Error deleting document:', error)
            alert('Error deleting document')
        }
    }

    const getDocIcon = (type: string) => {
        const icons: Record<string, string> = {
            'PDF': '📄',
            'Word': '📝',
            'Text': '📃',
            'Python': '🐍',
            'JavaScript': '📜',
            'ABAP': '💠'
        }
        return icons[type] || '📁'
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal max-w-4xl" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title flex items-center gap-2">
                        <span className="text-2xl">📤</span>
                        Document Upload & Management
                    </h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="modal-body">
                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="input-label">Upload Documents to Knowledge Base</label>
                        <p className="text-sm text-muted mb-4">
                            Upload PDF, DOCX, TXT files, or a ZIP archive (max 250KB) containing project files.
                        </p>
                        <div className="glass-subtle p-6 text-center border-2 border-dashed border-[var(--glass-border)] hover:border-indigo-500/50 transition-colors cursor-pointer">
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.docx,.txt,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <div className="text-4xl mb-3">📂</div>
                                <p className="text-heading font-medium">Click to browse or drag files here</p>
                                <p className="text-sm text-muted mt-1">PDF, DOCX, TXT, ZIP</p>
                            </label>
                        </div>
                        {uploading && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-indigo-400">
                                <span className="spinner w-4 h-4" />
                                <span>Uploading documents...</span>
                            </div>
                        )}
                    </div>

                    {/* Document List */}
                    <div className="glass-subtle p-4">
                        <h4 className="font-medium text-heading mb-4">📚 Knowledge Base Documents</h4>
                        {loadingDocs ? (
                            <div className="flex items-center justify-center py-8 text-muted">
                                <span className="spinner w-5 h-5 mr-2" />
                                Loading documents...
                            </div>
                        ) : documents.length === 0 ? (
                            <p className="text-sm text-muted py-4 text-center">No documents found. Upload files above to get started.</p>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Document Name</th>
                                            <th>Type</th>
                                            <th>Size</th>
                                            <th>Chunks</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {documents.map((doc: any, index: number) => (
                                            <tr key={index}>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <span>{getDocIcon(doc.type)}</span>
                                                        <span className="truncate max-w-xs" title={doc.name}>
                                                            {doc.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge badge-info">{doc.type}</span>
                                                </td>
                                                <td className="text-muted">{doc.size}</td>
                                                <td className="text-muted">{doc.chunks}</td>
                                                <td className="text-right">
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.name)}
                                                        className="btn btn-ghost text-red-400 hover:text-red-300 text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="mt-6 glass-subtle p-4">
                        <h4 className="font-medium text-indigo-300 mb-2">ℹ️ How it works</h4>
                        <p className="text-sm text-muted">
                            Documents uploaded here are processed and added to a vector database. When you use "Ask Yoda",
                            the system searches through these documents to find relevant information and provides AI-powered answers.
                        </p>
                    </div>
                </div>
            </div>

            {/* Duplicate Dialog */}
            {duplicateDialog.show && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
                    <div className="modal max-w-md">
                        <div className="modal-header">
                            <h3 className="modal-title">⚠️ Duplicate Document Detected</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-main">
                                A document named <strong className="text-heading">{duplicateDialog.filename}</strong> already exists in the knowledge base.
                                Would you like to overwrite it or skip this upload?
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={handleDuplicateSkip} className="btn btn-secondary">
                                Skip
                            </button>
                            <button onClick={handleDuplicateOverwrite} className="btn btn-primary">
                                Overwrite
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
