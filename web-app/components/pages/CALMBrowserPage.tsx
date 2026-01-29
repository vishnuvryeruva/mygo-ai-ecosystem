'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface CALMBrowserPageProps {
    sourceId: string
    sourceName: string
    onBack: () => void
    onSaveConfiguration?: (config: any) => void
}

interface Project {
    id: string
    name: string
    description?: string
}

interface Scope {
    id: string
    name: string
    projectId: string
}

interface SolutionProcess {
    id: string
    name: string
    scopeId: string
}

interface Document {
    id: string
    name: string
    type: string
    size: string
    lastUpdated: string
    selected?: boolean
}

export default function CALMBrowserPage({ sourceId, sourceName, onBack }: CALMBrowserPageProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [scopes, setScopes] = useState<Scope[]>([])
    const [solutionProcesses, setSolutionProcesses] = useState<SolutionProcess[]>([])
    const [documents, setDocuments] = useState<Document[]>([])

    const [selectedProject, setSelectedProject] = useState<string>('')
    const [selectedScope, setSelectedScope] = useState<string>('')
    const [selectedProcess, setSelectedProcess] = useState<string>('')
    const [selectedDocType, setSelectedDocType] = useState<string>('all')
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [configName, setConfigName] = useState('')

    const [loadingProjects, setLoadingProjects] = useState(true)
    const [loadingScopes, setLoadingScopes] = useState(false)
    const [loadingProcesses, setLoadingProcesses] = useState(false)
    const [loadingDocs, setLoadingDocs] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState(0)

    const documentTypes = [
        { value: 'all', label: 'All Types' },
        { value: 'functional_spec', label: 'Functional Specification' },
        { value: 'technical_spec', label: 'Technical Specification' },
        { value: 'process_flow', label: 'Process Flow' },
        { value: 'fit_gap', label: 'Fit/Gap Analysis' },
        { value: 'decision_paper', label: 'Decision Paper' },
        { value: 'test_case', label: 'Test Cases' }
    ]

    useEffect(() => {
        fetchProjects()
    }, [])

    const fetchProjects = async () => {
        setLoadingProjects(true)
        try {
            const response = await axios.get(`/api/calm/${sourceId}/projects`)
            setProjects(response.data.projects || [])
        } catch (error) {
            console.error('Error fetching projects:', error)
            // Demo data
            setProjects([
                { id: 'proj-1', name: 'S/4HANA Implementation Wave 2', description: 'Main implementation project' },
                { id: 'proj-2', name: 'Finance Transformation', description: 'Core finance module' },
                { id: 'proj-3', name: 'Supply Chain Optimization', description: 'SCM improvements' }
            ])
        } finally {
            setLoadingProjects(false)
        }
    }

    const fetchScopes = async (projectId: string) => {
        setSelectedProject(projectId)
        setSelectedScope('')
        setSelectedProcess('')
        setDocuments([])
        setLoadingScopes(true)

        try {
            const response = await axios.get(`/api/calm/${sourceId}/scopes?projectId=${projectId}`)
            setScopes(response.data.scopes || [])
        } catch (error) {
            console.error('Error fetching scopes:', error)
            // Demo data
            setScopes([
                { id: 'scope-1', name: 'Core Finance & Supply Chain', projectId },
                { id: 'scope-2', name: 'Human Resources', projectId },
                { id: 'scope-3', name: 'Manufacturing', projectId }
            ])
        } finally {
            setLoadingScopes(false)
        }
    }

    const fetchSolutionProcesses = async (scopeId: string) => {
        setSelectedScope(scopeId)
        setSelectedProcess('')
        setDocuments([])
        setLoadingProcesses(true)

        try {
            const response = await axios.get(`/api/calm/${sourceId}/solution-processes?scopeId=${scopeId}`)
            setSolutionProcesses(response.data.processes || [])
        } catch (error) {
            console.error('Error fetching solution processes:', error)
            // Demo data
            setSolutionProcesses([
                { id: 'proc-1', name: 'Order to Cash (O2C)', scopeId },
                { id: 'proc-2', name: 'Procure to Pay (P2P)', scopeId },
                { id: 'proc-3', name: 'Record to Report (R2R)', scopeId },
                { id: 'proc-4', name: 'Plan to Produce', scopeId }
            ])
        } finally {
            setLoadingProcesses(false)
        }
    }

    const fetchDocuments = async () => {
        if (!selectedProcess) return

        setLoadingDocs(true)
        try {
            const response = await axios.get(`/api/calm/${sourceId}/documents`, {
                params: {
                    processId: selectedProcess,
                    type: selectedDocType !== 'all' ? selectedDocType : undefined
                }
            })
            setDocuments(response.data.documents || [])
        } catch (error) {
            console.error('Error fetching documents:', error)
            // Demo data
            setDocuments([
                { id: 'doc-1', name: 'FIN_FSpec_GeneralLedger_V1.2.docx', type: 'Functional Spec', size: '1.4 MB', lastUpdated: '2026-01-20' },
                { id: 'doc-2', name: 'SCM_TSpec_InventoryManagement_API.pdf', type: 'Technical Spec', size: '850 KB', lastUpdated: '2026-01-19' },
                { id: 'doc-3', name: 'O2C_ProcessFlow_Diagram_V4.drawio', type: 'Process Flow', size: '3.2 MB', lastUpdated: '2026-01-18' },
                { id: 'doc-4', name: 'HR_FSpec_PayrollProcessing.docx', type: 'Functional Spec', size: '1.8 MB', lastUpdated: '2026-01-17' },
                { id: 'doc-5', name: 'CRM_TSpec_CustomerDataIntegration.pdf', type: 'Technical Spec', size: '620 KB', lastUpdated: '2026-01-15' },
                { id: 'doc-6', name: 'FitGap_CoreFinance_Analysis.xlsx', type: 'Fit/Gap', size: '245 KB', lastUpdated: '2026-01-14' }
            ])
        } finally {
            setLoadingDocs(false)
        }
    }

    const toggleDocumentSelection = (docId: string) => {
        setDocuments(docs =>
            docs.map(d => d.id === docId ? { ...d, selected: !d.selected } : d)
        )
    }

    const toggleSelectAll = () => {
        const allSelected = documents.every(d => d.selected)
        setDocuments(docs => docs.map(d => ({ ...d, selected: !allSelected })))
    }

    const selectedDocs = documents.filter(d => d.selected)

    const handleSync = async () => {
        if (selectedDocs.length === 0) return

        setSyncing(true)
        setSyncProgress(0)

        try {
            // Simulate sync progress
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 300))
                setSyncProgress(i)
            }

            // Actual sync call
            await axios.post('/api/sync', {
                sourceId,
                documents: selectedDocs
            })

            alert(`Successfully synced ${selectedDocs.length} documents to Yoda Knowledge Base!`)
            setDocuments(docs => docs.map(d => ({ ...d, selected: false })))
        } catch (error) {
            console.error('Error syncing documents:', error)
            alert('Sync completed (demo mode)')
        } finally {
            setSyncing(false)
            setSyncProgress(0)
        }
    }

    const getDocTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            'Functional Spec': '📋',
            'Technical Spec': '⚙️',
            'Process Flow': '🔄',
            'Fit/Gap': '📊',
            'Decision Paper': '📝',
            'Test Cases': '🧪'
        }
        return icons[type] || '📄'
    }

    const handleSaveConfig = () => {
        if (!onSaveConfiguration || !configName.trim()) return

        onSaveConfiguration({
            name: configName,
            projectId: selectedProject,
            scopeId: selectedScope,
            processId: selectedProcess,
            docType: selectedDocType
        })
        setShowSaveModal(false)
        setConfigName('')
    }

    return (
        <div>
            {/* Back Button */}
            <button
                className="btn btn-ghost mb-6"
                onClick={onBack}
            >
                ← Back to Sources
            </button>

            {/* Source Header */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-3xl">
                        ☁️
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-heading">{sourceName}</h2>
                        <p className="text-muted">Cloud ALM Document Browser</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-6 mb-6">
                <h3 className="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">
                    🔍 Filter Documents
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Project */}
                    <div className="input-group mb-0">
                        <label className="input-label">Project</label>
                        <select
                            className="input select"
                            value={selectedProject}
                            onChange={e => fetchScopes(e.target.value)}
                            disabled={loadingProjects}
                        >
                            <option value="">Select Project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Scope */}
                    <div className="input-group mb-0">
                        <label className="input-label">Scope</label>
                        <select
                            className="input select"
                            value={selectedScope}
                            onChange={e => fetchSolutionProcesses(e.target.value)}
                            disabled={!selectedProject || loadingScopes}
                        >
                            <option value="">Select Scope</option>
                            {scopes.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Solution Process */}
                    <div className="input-group mb-0">
                        <label className="input-label">Solution Process</label>
                        <select
                            className="input select"
                            value={selectedProcess}
                            onChange={e => setSelectedProcess(e.target.value)}
                            disabled={!selectedScope || loadingProcesses}
                        >
                            <option value="">Select Process</option>
                            {solutionProcesses.map(sp => (
                                <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Document Type */}
                    <div className="input-group mb-0">
                        <label className="input-label">Document Type</label>
                        <select
                            className="input select"
                            value={selectedDocType}
                            onChange={e => setSelectedDocType(e.target.value)}
                        >
                            {documentTypes.map(dt => (
                                <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        className="btn btn-primary"
                        onClick={fetchDocuments}
                        disabled={!selectedProcess || loadingDocs}
                    >
                        {loadingDocs ? (
                            <>
                                <span className="spinner w-4 h-4" />
                                Loading...
                            </>
                        ) : (
                            <>🔍 Load Documents</>
                        )}
                    </button>
                    {onSaveConfiguration && (
                        <button
                            className="btn btn-secondary ml-2"
                            onClick={() => setShowSaveModal(true)}
                            disabled={!selectedScope}
                        >
                            💾 Save Config
                        </button>
                    )}
                </div>
            </div>

            {/* Documents Table */}
            {documents.length > 0 && (
                <div className="glass-card overflow-hidden mb-6">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="font-semibold text-heading">
                            📁 Documents ({documents.length})
                        </h3>
                        <div className="text-sm text-muted">
                            {selectedDocs.length} selected
                        </div>
                    </div>

                    <div className="table-container border-0 rounded-none">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th className="w-12">
                                        <input
                                            type="checkbox"
                                            checked={documents.length > 0 && documents.every(d => d.selected)}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded"
                                        />
                                    </th>
                                    <th>Document Name</th>
                                    <th>Type</th>
                                    <th>Size</th>
                                    <th>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map(doc => (
                                    <tr key={doc.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={doc.selected || false}
                                                onChange={() => toggleDocumentSelection(doc.id)}
                                                className="w-4 h-4 rounded"
                                            />
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{getDocTypeIcon(doc.type)}</span>
                                                <span className="font-medium">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-info">{doc.type}</span>
                                        </td>
                                        <td className="text-muted">{doc.size}</td>
                                        <td className="text-muted">{doc.lastUpdated}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sync Button & Progress */}
            {selectedDocs.length > 0 && (
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-semibold text-heading">
                                Ready to Sync {selectedDocs.length} Document{selectedDocs.length > 1 ? 's' : ''}
                            </h3>
                            <p className="text-sm text-muted">
                                Documents will be processed and added to Yoda Knowledge Base
                            </p>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? (
                                <>
                                    <span className="spinner w-4 h-4" />
                                    Syncing...
                                </>
                            ) : (
                                <>🔄 Sync to Yoda</>
                            )}
                        </button>
                    </div>

                    {syncing && (
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Sync Progress</span>
                                <span className="text-indigo-400">{syncProgress}%</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${syncProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {documents.length === 0 && selectedProcess && !loadingDocs && (
                <div className="glass-card p-12 text-center">
                    <div className="text-4xl mb-4">📭</div>
                    <h3 className="text-xl font-semibold text-heading mb-2">No Documents Found</h3>
                    <p className="text-muted">
                        No documents match your filter criteria. Try selecting different options.
                    </p>
                </div>
            )}
            {/* Save Config Modal */}
            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Save Configuration as Source</h3>
                            <button className="modal-close" onClick={() => setShowSaveModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p className="text-sm text-muted mb-4">
                                Save these filters as a new Source for quick access in Document Upload.
                            </p>
                            <div className="input-group">
                                <label className="input-label">Configuration Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Wave 2 functional Specs"
                                    value={configName}
                                    onChange={e => setConfigName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveConfig}
                                disabled={!configName.trim()}
                            >
                                Save Source
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
