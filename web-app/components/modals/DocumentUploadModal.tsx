'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import LoadingSpinner, { LoadingOverlay } from '../LoadingSpinner'

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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">Document Upload & Management</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Documents to Knowledge Base
                        </label>
                        <p className="text-sm text-gray-500 mb-4">
                            Upload PDF, DOCX, TXT files, or a ZIP archive (max 250KB) containing project files.
                        </p>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.docx,.txt,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
                        />
                        {uploading && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                                <LoadingSpinner size="sm" color="orange" />
                                <span>Uploading documents...</span>
                            </div>
                        )}
                    </div>

                    {/* Document List */}
                    <div className="border rounded-lg p-4 bg-gray-50 relative">
                        <h4 className="font-medium text-gray-900 mb-4">Knowledge Base Documents</h4>
                        {loadingDocs ? (
                            <div className="flex items-center justify-center py-8">
                                <LoadingSpinner size="md" color="orange" text="Loading documents..." />
                            </div>
                        ) : documents.length === 0 ? (
                            <p className="text-sm text-gray-500">No documents found. Upload files above to get started.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Document Name
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Size
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Chunks
                                            </th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {documents.map((doc: any, index: number) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    <div className="flex items-center">
                                                        <span className="mr-2">
                                                            {doc.type === 'PDF' && '📄'}
                                                            {doc.type === 'Word' && '📝'}
                                                            {doc.type === 'Text' && '📃'}
                                                            {doc.type === 'Python' && '🐍'}
                                                            {doc.type === 'JavaScript' && '📜'}
                                                            {doc.type === 'ABAP' && '💠'}
                                                            {!['PDF', 'Word', 'Text', 'Python', 'JavaScript', 'ABAP'].includes(doc.type) && '📁'}
                                                        </span>
                                                        <span className="truncate max-w-xs" title={doc.name}>
                                                            {doc.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                                                        {doc.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {doc.size}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {doc.chunks}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.name)}
                                                        className="text-red-600 hover:text-red-800 font-medium"
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
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">ℹ️ How it works</h4>
                        <p className="text-sm text-blue-800">
                            Documents uploaded here are processed and added to a vector database. When you use "Ask Yoda",
                            the system searches through these documents to find relevant information and provides AI-powered answers.
                        </p>
                    </div>
                </div>
            </div>

            {/* Duplicate Dialog */}
            {duplicateDialog.show && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Duplicate Document Detected</h3>
                        <p className="text-gray-700 mb-6">
                            A document named <strong>{duplicateDialog.filename}</strong> already exists in the knowledge base.
                            Would you like to overwrite it or skip this upload?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDuplicateOverwrite}
                                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                            >
                                Overwrite
                            </button>
                            <button
                                onClick={handleDuplicateSkip}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
