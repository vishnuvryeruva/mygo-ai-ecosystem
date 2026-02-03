'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AddDocumentModal from '@/components/modals/AddDocumentModal'

interface DocumentInfo {
    name: string
    type: string
    size: string
    chunks: number
    uploadDate: string
    // Optional fields - may come from synced documents
    source?: string
    updatedBy?: string
    project?: string
    scope?: string
}

export default function DocumentUploadPage() {
    const [loadingDocs, setLoadingDocs] = useState(true)
    const [documents, setDocuments] = useState<DocumentInfo[]>([])
    const [showAddModal, setShowAddModal] = useState(false)

    // Filters
    const [filterSource, setFilterSource] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterProject, setFilterProject] = useState('')
    const [filterDate, setFilterDate] = useState('')

    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        setLoadingDocs(true)
        try {
            const response = await axios.get('/api/documents')
            setDocuments(response.data.documents || [])
        } catch (error) {
            console.error('Error fetching documents:', error)
            // Don't show mock data - let empty state appear
            setDocuments([])
        } finally {
            setLoadingDocs(false)
        }
    }

    const handleSyncComplete = (newDocs?: DocumentInfo[]) => {
        // If new docs provided, optimistically add them to the list
        if (newDocs && newDocs.length > 0) {
            setDocuments(prevDocs => [...newDocs, ...prevDocs])
        } else {
            // Refresh documents from API
            fetchDocuments()
        }
        setShowAddModal(false)
    }

    const handleDeleteDocument = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return
        try {
            await axios.delete(`/api/documents/${encodeURIComponent(filename)}`)
            setDocuments(documents.filter(d => d.name !== filename))
        } catch (error) {
            console.error('Error deleting document:', error)
            setDocuments(documents.filter(d => d.name !== filename))
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

    // Filter Logic
    const filteredDocuments = documents.filter(doc => {
        if (filterSource && !(doc.source || '').toLowerCase().includes(filterSource.toLowerCase())) return false
        if (filterType && !doc.type.toLowerCase().includes(filterType.toLowerCase())) return false
        if (filterProject && !(doc.project || '').toLowerCase().includes(filterProject.toLowerCase())) return false
        if (filterDate && !doc.uploadDate.startsWith(filterDate)) return false
        return true
    })

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-heading mb-1">Documents</h2>
                    <p className="text-muted">Manage and upload knowledge base documents</p>
                </div>
            </div>

            {/* Top Toolbar: Filters + Action */}
            <div className="glass-card p-4 mb-6 flex flex-wrap lg:flex-nowrap gap-4 items-end">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                    <div className="input-group">
                        <label className="input-label mb-1">Source</label>
                        <input
                            type="text"
                            className="input h-10 w-full"
                            placeholder="All Sources"
                            value={filterSource}
                            onChange={e => setFilterSource(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label mb-1">Document Type</label>
                        <input
                            type="text"
                            className="input h-10 w-full"
                            placeholder="All Types"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label mb-1">Project</label>
                        <input
                            type="text"
                            className="input h-10 w-full"
                            placeholder="All Projects"
                            value={filterProject}
                            onChange={e => setFilterProject(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label mb-1">Updated On</label>
                        <input
                            type={filterDate ? "date" : "text"}
                            placeholder="Select date"
                            className="input h-10 w-full text-gray-400 focus:text-gray-900"
                            value={filterDate ?? ""}
                            onFocus={e => e.target.type = "date"}
                            onBlur={e => {
                                if (!filterDate) e.target.type = "text";
                            }}
                            onChange={e => setFilterDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-none pt-4 md:pt-0 self-center mt-2">
                    {/* <label className="input-label mb-1"></label> */}
                    <button
                        className="btn btn-primary h-10 px-6 flex items-center gap-2 whitespace-nowrap w-full md:w-auto justify-center"
                        onClick={() => setShowAddModal(true)}
                    >
                        <span>➕</span> Add/Sync Documents
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="glass-card flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto p-0">
                    <table className="table w-full relative">
                        <thead className="bg-[#1A1D24] sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="text-left p-4 pl-6 text-sm font-semibold text-gray-300">Source</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Document Type</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Document Name</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Updated By</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Updated On</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Project</th>
                                <th className="text-left p-4 text-sm font-semibold text-gray-300">Scope</th>
                                <th className="text-right p-4 pr-6 text-sm font-semibold text-gray-300">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loadingDocs ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-muted">
                                        <span className="spinner w-5 h-5 inline-block mr-2" /> Loading...
                                    </td>
                                </tr>
                            ) : filteredDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted">
                                        No documents found.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocuments.map((doc, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                                ${doc.source === 'CALM' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    doc.source === 'SharePoint' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border-gray-500/20'}
                                            `}>
                                                {doc.source}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-300">{doc.type}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg opacity-70">{getDocIcon(doc.type)}</span>
                                                <span className="text-sm font-medium text-white">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">{doc.updatedBy}</td>
                                        <td className="p-4 text-sm text-gray-400">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                        <td className="p-4 text-sm text-gray-300 max-w-[200px] truncate" title={doc.project}>{doc.project}</td>
                                        <td className="p-4 text-sm text-gray-300">{doc.scope}</td>
                                        <td className="p-4 pr-6 text-right">
                                            <button
                                                onClick={() => handleDeleteDocument(doc.name)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <AddDocumentModal
                    onClose={() => setShowAddModal(false)}
                    onSyncComplete={handleSyncComplete}
                />
            )}
        </div>
    )
}
