'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface Source {
    id: string
    name: string
    type: 'CALM' | 'SharePoint' | 'SolMan'
    status: 'connected' | 'disconnected' | 'error'
    lastSync: string | null
    config: {
        apiEndpoint?: string
        tokenUrl?: string
        clientId?: string
        filters?: {
            projectId: string
            scopeId: string
            processId: string
        }
    }
}

export default function SourcesPage() {
    const [sources, setSources] = useState<Source[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingSource, setEditingSource] = useState<Source | null>(null)
    const [testingConnection, setTestingConnection] = useState<string | null>(null)

    useEffect(() => {
        fetchSources()
    }, [])

    const fetchSources = async () => {
        try {
            const response = await axios.get('/api/sources')
            setSources(response.data.sources || [])
        } catch (error) {
            console.error('Error fetching sources:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTestConnection = async (sourceId: string) => {
        setTestingConnection(sourceId)
        try {
            const response = await axios.post(`/api/sources/${sourceId}/test`)
            console.log(response.data)
            if (response.data.success) {
                setSources(sources.map(s =>
                    s.id === sourceId ? { ...s, status: 'connected' as const } : s
                ))
            } else {
                setSources(sources.map(s =>
                    s.id === sourceId ? { ...s, status: 'error' as const } : s
                ))
            }
        } catch (error) {
            setSources(sources.map(s =>
                s.id === sourceId ? { ...s, status: 'error' as const } : s
            ))
        } finally {
            setTestingConnection(null)
        }
    }

    const handleDeleteSource = async (sourceId: string) => {
        const confirmed = window.confirm('Are you sure you want to delete this source?')
        if (!confirmed) return

        try {
            await axios.delete(`/api/sources/${sourceId}`)
            setSources(prevSources => prevSources.filter(s => s.id !== sourceId))
        } catch (error) {
            console.error('Error deleting source:', error)
            setSources(prevSources => prevSources.filter(s => s.id !== sourceId))
        }
    }

    const handleEditSource = (source: Source) => {
        setEditingSource(source)
        setShowModal(true)
    }

    const handleAddSource = () => {
        setEditingSource(null)
        setShowModal(true)
    }

    const getStatusBadge = (status: Source['status']) => {
        const badges = {
            connected: { class: 'badge-success', icon: '●', text: 'Connected' },
            disconnected: { class: 'badge-warning', icon: '○', text: 'Disconnected' },
            error: { class: 'badge-error', icon: '✕', text: 'Error' }
        }
        const badge = badges[status]
        return (
            <span className={`badge ${badge.class}`}>
                {badge.icon} {badge.text}
            </span>
        )
    }

    const getSourceIcon = (type: Source['type']) => {
        const icons = {
            CALM: '☁️',
            SharePoint: '📁',
            SolMan: '🔧'
        }
        return icons[type] || '📦'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner" />
            </div>
        )
    }

    return (
        <div>
            {/* Header Actions */}
            <div className="flex justify-end mb-6">
                <button
                    className="btn btn-primary"
                    onClick={handleAddSource}
                >
                    <span>➕</span>
                    Add Source
                </button>
            </div>

            {/* Sources Grid */}
            {sources.length === 0 ? (
                <div className="card p-12 text-center bg-gray-50 border-dashed border-2">
                    <div className="text-4xl mb-4">🔌</div>
                    <h3 className="text-xl font-semibold text-heading mb-2">No Sources Configured</h3>
                    <p className="text-muted mb-6">
                        Connect to Cloud ALM, SharePoint, or SolMan to import documents.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={handleAddSource}
                    >
                        Add Your First Source
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sources.map((source) => (
                        <div key={source.id} className="card p-6 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl border border-orange-100">
                                        {getSourceIcon(source.type)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-heading">{source.name}</h3>
                                        <p className="text-sm text-muted">{source.type}</p>
                                    </div>
                                </div>
                                {getStatusBadge(source.status)}
                            </div>

                            <div className="text-sm text-muted mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                {source.lastSync ? (
                                    <span>Last synced: {new Date(source.lastSync).toLocaleString()}</span>
                                ) : (
                                    <span>Never synced</span>
                                )}
                                {source.config.filters && (
                                    <div className="mt-2 text-xs text-blue-600 font-medium">
                                        Filters Applied: Project/Scope
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    className="btn btn-secondary flex-1"
                                    onClick={() => handleTestConnection(source.id)}
                                    disabled={testingConnection === source.id}
                                >
                                    {testingConnection === source.id ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="spinner w-4 h-4 border-gray-400 border-t-blue-600" /> Testing
                                        </span>
                                    ) : (
                                        'Test Connection'
                                    )}
                                </button>
                                <button
                                    className="btn btn-ghost hover:bg-gray-100 rounded-lg p-2"
                                    onClick={() => handleEditSource(source)}
                                    title="Edit Source"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="btn btn-ghost text-red-500 hover:bg-red-50 rounded-lg p-2"
                                    onClick={() => handleDeleteSource(source.id)}
                                    title="Delete Source"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Source Modal */}
            {showModal && (
                <SourceModal
                    source={editingSource}
                    onClose={() => setShowModal(false)}
                    onSave={(savedSource) => {
                        if (editingSource) {
                            setSources(sources.map(s => s.id === savedSource.id ? savedSource : s))
                        } else {
                            setSources([...sources, savedSource])
                        }
                        setShowModal(false)
                    }}
                />
            )}
        </div>
    )
}

// Add/Edit Source Modal Component
interface SourceModalProps {
    source: Source | null
    onClose: () => void
    onSave: (source: Source) => void
}

function SourceModal({ source, onClose, onSave }: SourceModalProps) {
    const [formData, setFormData] = useState({
        name: source?.name || '',
        type: source?.type || 'CALM' as Source['type'],
        apiEndpoint: source?.config?.apiEndpoint || '',
        tokenUrl: source?.config?.tokenUrl || '',
        clientId: source?.config?.clientId || '',
        clientSecret: '' // Never show existing secret
    })
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
    const [saving, setSaving] = useState(false)

    const handleTestConnection = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const response = await axios.post('/api/sources/test-connection', formData)
            console.log(response.data)
            if (response.data.success) {
                setTestResult('success')
            } else {
                setTestResult('error')
            }
        } catch (error) {
            setTestResult('error')
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert('Please enter a Source Name')
            return
        }

        setSaving(true)
        try {
            let response;
            if (source) {
                // Update existing
                response = await axios.put(`/api/sources/${source.id}`, formData)
            } else {
                // Create new
                response = await axios.post('/api/sources', formData)
            }
            onSave(response.data.source)
        } catch (error) {
            console.error('Error saving source:', error)
            alert('Failed to save source. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{source ? 'Edit Source' : 'Add New Source'}</h2>
                    <button className="modal-close text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body max-h-[70vh] overflow-y-auto">
                    <div className="input-group">
                        <label className="input-label">Source Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g., My Cloud ALM Instance"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Source Type</label>
                        <div className="flex gap-4 mt-2">
                            {(['CALM', 'SharePoint', 'SolMan'] as const).map(type => (
                                <label
                                    key={type}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all border
                    ${formData.type === type
                                            ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm'
                                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="type"
                                        value={type}
                                        checked={formData.type === type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as Source['type'] })}
                                        className="hidden"
                                    />
                                    <span>{type === 'CALM' ? '☁️' : type === 'SharePoint' ? '📁' : '🔧'}</span>
                                    <span className="text-sm font-medium">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-6 pt-6">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Connection Details</h3>

                        <div className="input-group">
                            <label className="input-label">API Endpoint</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://tenant.us10.alm.cloud.sap"
                                value={formData.apiEndpoint}
                                onChange={e => setFormData({ ...formData, apiEndpoint: e.target.value })}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Token URL</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://tenant.authentication.us10.hana.ondemand.com/oauth/token"
                                value={formData.tokenUrl}
                                onChange={e => setFormData({ ...formData, tokenUrl: e.target.value })}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Client ID</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="client_id"
                                value={formData.clientId}
                                onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Client Secret {source && '(Leave blank to keep unchanged)'}</label>
                            <input
                                type="password"
                                className="input"
                                placeholder={source ? "••••••••" : "client_secret"}
                                value={formData.clientSecret}
                                onChange={e => setFormData({ ...formData, clientSecret: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        className="btn btn-secondary w-full mb-4"
                        onClick={handleTestConnection}
                        disabled={testing || !formData.apiEndpoint}
                    >
                        {testing ? (
                            <>
                                <span className="spinner w-4 h-4 border-gray-400 border-t-blue-600" />
                                Testing Connection...
                            </>
                        ) : (
                            <>🔗 Test Connection</>
                        )}
                    </button>

                    {testResult === 'success' && (
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl mb-4 border border-green-100">
                            ✅ Connection successful!
                        </div>
                    )}
                    {testResult === 'error' && (
                        <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-xl mb-4 border border-red-100">
                            ❌ Connection failed! Check console for details.
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="spinner w-4 h-4" />
                                Saving...
                            </>
                        ) : (
                            <>💾 Save {source ? 'Changes' : 'Source'}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
