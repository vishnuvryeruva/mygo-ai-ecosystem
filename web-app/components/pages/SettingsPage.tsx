'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

/* ─── Tab definitions ──────────────────────────────────── */
const settingsTabs = [
    { id: 'prompts', label: 'Manage Prompts', icon: '💬' },
    { id: 'sources', label: 'Manage Sources', icon: '⚙️' },
    { id: 'roles', label: 'Manage Roles', icon: '🔑' },
    { id: 'credits', label: 'Manage AI Credits', icon: '⚡' },
    { id: 'users', label: 'User Management', icon: '👥' },
]

/* ─── Prompts data ─────────────────────────────────────── */
const aiScenarios = [
    { id: 'ask-yoda', title: 'Ask Yoda - RAG Q&A', subtitle: 'System prompt used for answering questions using RAG (Retrieval Augmented Generation)', active: true },
    { id: 'code-quality', title: 'Code Quality Advisor', subtitle: 'Prompts for code quality analysis and recommendations', active: false },
    { id: 'code-explanation', title: 'Code Explanation', subtitle: 'Prompts for explaining code functionality', active: false },
    { id: 'llm-prompt', title: 'LLM Prompt Generator', subtitle: 'Prompts for generating optimized LLM prompts for code generation', active: false },
    { id: 'func-spec', title: 'Functional Specification Generator', subtitle: 'Prompts for generating functional specification documents', active: false },
    { id: 'tech-spec', title: 'Technical Specification Generator', subtitle: 'Prompts for generating technical specification documents', active: false },
]

/* ─── Roles default data ───────────────────────────────── */
interface Role {
    id: string
    name: string
    permissions: string[]
}

const defaultRoles: Role[] = [
    { id: 'admin', name: 'Admin', permissions: ['Read', 'Write', 'Delete', 'Manage Users'] },
    { id: 'editor', name: 'Editor', permissions: ['Read', 'Write'] },
    { id: 'viewer', name: 'Viewer', permissions: ['Read'] },
]

/* ─── Sources default data ─────────────────────────────── */
interface Source {
    id: string
    name: string
    tenant?: string
    authType?: string
    type?: string
    status?: string
    config?: {
        apiEndpoint?: string
        tokenUrl?: string
        clientId?: string
    }
}

/* ─── Users default data ───────────────────────────────── */
interface User {
    id: string
    name: string
    email: string
    role: string
    status: 'Active' | 'Inactive'
}

const defaultUsers: User[] = [
    { id: '1', name: 'Sarah Johnson', email: 'sarah.johnson@mygo.com', role: 'Admin', status: 'Active' },
    { id: '2', name: 'Michael Chen', email: 'michael.chen@mygo.com', role: 'Editor', status: 'Active' },
    { id: '3', name: 'Emily Davis', email: 'emily.davis@mygo.com', role: 'Viewer', status: 'Active' },
    { id: '4', name: 'Robert Wilson', email: 'robert.wilson@mygo.com', role: 'Viewer', status: 'Inactive' },
]

/* ─── Credit usage data ────────────────────────────────── */
const creditBreakdown = [
    { agent: 'Ask Yoda', credits: 3200, color: '#034354' },
    { agent: 'Spec Agent', credits: 2100, color: '#ff682c' },
    { agent: 'Other Agents', credits: 2200, color: '#64748b' },
]

/* ─── Connection form shape ────────────────────────────── */
interface ConnectionForm {
    sourceName: string
    authType: string
    clientId: string
    clientSecret: string
    apiEndpoint: string
    tokenUrl: string
}

const emptyConnection: ConnectionForm = {
    sourceName: '',
    authType: 'OAuth 2.0',
    clientId: '',
    clientSecret: '',
    apiEndpoint: '',
    tokenUrl: '',
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('prompts')

    /* Prompts state */
    const [activeScenario, setActiveScenario] = useState('ask-yoda')
    const [systemPrompt, setSystemPrompt] = useState(
        `You are Yoda, a wise AI assistant with access to a knowledge base of SAP documents, specifications, blueprints, and test cases. Provide accurate, helpful answers based on the provided context.\nIf the context doesn't contain enough information, say so clearly.\nAlways cite relevant documents when answering.`
    )

    /* Sources state */
    const [sources, setSources] = useState<Source[]>([])
    const [showAddConnection, setShowAddConnection] = useState(false)
    const [connectionForm, setConnectionForm] = useState<ConnectionForm>(emptyConnection)
    const [isLoadingSources, setIsLoadingSources] = useState(false)
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [isSavingConnection, setIsSavingConnection] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    /* Roles state */
    const [roles, setRoles] = useState<Role[]>(defaultRoles)
    const [newRoleName, setNewRoleName] = useState('')

    /* Users state */
    const [users, setUsers] = useState<User[]>(defaultUsers)
    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Viewer' })

    /* ── Effects ────────────────────────────────────────── */
    useEffect(() => {
        if (activeTab === 'sources') {
            refreshSources()
        }
    }, [activeTab])

    useEffect(() => {
        if (!showAddConnection) {
            setConnectionForm(emptyConnection)
            setTestResult(null)
        }
    }, [showAddConnection])

    const refreshSources = async () => {
        setIsLoadingSources(true)
        try {
            const res = await axios.get('http://localhost:5001/api/sources')
            setSources(res.data.sources || [])
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        } finally {
            setIsLoadingSources(false)
        }
    }

    /* ── Helpers ────────────────────────────────────────── */
    const handleTestConnection = async () => {
        if (!connectionForm.apiEndpoint || !connectionForm.tokenUrl || !connectionForm.clientId || !connectionForm.clientSecret) {
            setTestResult({ success: false, message: 'Please fill in all required fields' })
            return
        }

        setIsTestingConnection(true)
        setTestResult(null)

        try {
            const response = await axios.post('http://localhost:5001/api/sources/test-connection', {
                type: 'CALM',
                apiEndpoint: connectionForm.apiEndpoint,
                tokenUrl: connectionForm.tokenUrl,
                clientId: connectionForm.clientId,
                clientSecret: connectionForm.clientSecret
            })

            if (response.data.success) {
                setTestResult({ success: true, message: 'Connection successful! You can now save this source.' })
            } else {
                setTestResult({ success: false, message: response.data.error || 'Connection failed' })
            }
        } catch (err: any) {
            console.error('Test connection error:', err)
            setTestResult({ 
                success: false, 
                message: err.response?.data?.error || 'Failed to test connection. Please check your credentials.' 
            })
        } finally {
            setIsTestingConnection(false)
        }
    }

    const handleAddSource = async () => {
        if (!connectionForm.sourceName || !connectionForm.apiEndpoint) {
            alert('Please fill in at least Source Name and API Endpoint')
            return
        }

        setIsSavingConnection(true)
        try {
            await axios.post('http://localhost:5001/api/sources', {
                name: connectionForm.sourceName,
                type: 'CALM',
                apiEndpoint: connectionForm.apiEndpoint,
                tokenUrl: connectionForm.tokenUrl,
                clientId: connectionForm.clientId,
                clientSecret: connectionForm.clientSecret,
                authType: connectionForm.authType
            })

            await refreshSources()
            setConnectionForm(emptyConnection)
            setTestResult(null)
            setShowAddConnection(false)
        } catch (err: any) {
            console.error('Failed to add source:', err)
            alert(err.response?.data?.error || 'Failed to add source. Please check the console.')
        } finally {
            setIsSavingConnection(false)
        }
    }

    const handleDeleteSource = async (id: string) => {
        if (!confirm('Are you sure you want to delete this source?')) return
        try {
            await axios.delete(`http://localhost:5001/api/sources/${id}`)
            await refreshSources()
        } catch (err) {
            console.error('Failed to delete source:', err)
            alert('Failed to delete source')
        }
    }

    const handleAddRole = () => {
        if (!newRoleName.trim()) return
        const newRole: Role = {
            id: Date.now().toString(),
            name: newRoleName.trim(),
            permissions: ['Read'],
        }
        setRoles([...roles, newRole])
        setNewRoleName('')
    }

    const handleDeleteRole = (id: string) => {
        setRoles(roles.filter(r => r.id !== id))
    }

    const handleTogglePermission = (roleId: string, permission: string) => {
        setRoles(roles.map(r => {
            if (r.id !== roleId) return r
            const has = r.permissions.includes(permission)
            return {
                ...r,
                permissions: has
                    ? r.permissions.filter(p => p !== permission)
                    : [...r.permissions, permission],
            }
        }))
    }

    const handleAddUser = () => {
        if (!newUser.name.trim() || !newUser.email.trim()) return
        const user: User = {
            id: Date.now().toString(),
            name: newUser.name.trim(),
            email: newUser.email.trim(),
            role: newUser.role,
            status: 'Active',
        }
        setUsers([...users, user])
        setNewUser({ name: '', email: '', role: 'Viewer' })
    }

    const handleDeleteUser = (id: string) => {
        setUsers(users.filter(u => u.id !== id))
    }

    /* ── Tab content renderer ──────────────────────────── */
    const renderContent = () => {
        switch (activeTab) {
            /* ── MANAGE PROMPTS ─────────────────────── */
            case 'prompts':
                return (
                    <div className="settings-prompts-layout">
                        <div className="settings-scenarios-panel">
                            <h3 className="settings-panel-title">AI Scenarios</h3>
                            <div className="settings-scenarios-list">
                                {aiScenarios.map((scenario) => (
                                    <button
                                        key={scenario.id}
                                        className={`settings-scenario-item ${activeScenario === scenario.id ? 'active' : ''}`}
                                        onClick={() => setActiveScenario(scenario.id)}
                                    >
                                        <div className="settings-scenario-title">{scenario.title}</div>
                                        <div className="settings-scenario-subtitle">{scenario.subtitle}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="settings-editor-panel">
                            <h2 className="settings-editor-heading">{aiScenarios.find(s => s.id === activeScenario)?.title}</h2>
                            <p className="settings-editor-desc">
                                {aiScenarios.find(s => s.id === activeScenario)?.subtitle}
                            </p>
                            <h3 className="settings-panel-title" style={{ marginTop: 24 }}>System Prompt</h3>
                            <p className="settings-editor-desc">This defines the AI&apos;s role and behavior for this scenario.</p>
                            <textarea
                                className="settings-prompt-textarea"
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                rows={10}
                            />
                            <div className="settings-editor-actions">
                                <button className="btn btn-primary">Save Changes</button>
                                <button className="btn btn-secondary">Reset to Saved</button>
                            </div>
                            <div className="settings-info-box">
                                <span className="settings-info-icon">⚠️</span>
                                <div>
                                    <strong>Note</strong>
                                    <p>Changes to prompts are stored in memory and will be reset when the backend restarts. For persistent changes, modify the prompts in the backend configuration file.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            /* ── MANAGE SOURCES ─────────────────────── */
            case 'sources':
                return (
                    <div className="settings-section-content">
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">Manage Sources</h2>
                                <p className="settings-section-desc">Configure connections to external document sources</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowAddConnection(true)}>
                                + Add Connection
                            </button>
                        </div>

                        <div className="settings-source-list">
                            {isLoadingSources ? (
                                <div className="p-8 text-center text-gray-500">Loading sources...</div>
                            ) : (
                                <>
                                    {sources.map((source) => (
                                        <div key={source.id} className="settings-source-card">
                                            <div className="settings-source-icon">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff682c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="3" />
                                                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                                                </svg>
                                            </div>
                                            <div className="settings-source-info">
                                                <div className="settings-source-name">{source.name}</div>
                                                <div className="settings-source-meta">Type: {source.type} · Host: {source.config?.apiEndpoint ? new URL(source.config.apiEndpoint).hostname : 'N/A'}</div>
                                            </div>
                                            <div className="settings-source-actions">
                                                <button className="settings-icon-btn danger" title="Delete" onClick={() => handleDeleteSource(source.id)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {sources.length === 0 && (
                                        <div className="settings-empty-state">
                                            <p>No sources configured yet. Click &quot;Add Connection&quot; to get started.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Add Connection Modal */}
                        {showAddConnection && (
                            <div className="settings-modal-overlay" onClick={() => {
                                setShowAddConnection(false)
                                setTestResult(null)
                            }}>
                                <div className="settings-modal" onClick={e => e.stopPropagation()}>
                                    <div className="settings-modal-header">
                                        <div>
                                            <h3 className="settings-modal-title">Add Connection</h3>
                                            <p className="settings-modal-desc">Configure the source connection details</p>
                                        </div>
                                        <button className="settings-modal-close" onClick={() => {
                                            setShowAddConnection(false)
                                            setTestResult(null)
                                        }}>×</button>
                                    </div>
                                    <div className="settings-modal-body">
                                        <div className="settings-form-group">
                                            <label>Source Name *</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Mygo Cloud ALM"
                                                value={connectionForm.sourceName}
                                                onChange={e => setConnectionForm({ ...connectionForm, sourceName: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Authentication Type *</label>
                                            <select
                                                value={connectionForm.authType}
                                                onChange={e => setConnectionForm({ ...connectionForm, authType: e.target.value })}
                                            >
                                                <option value="OAuth 2.0">OAuth 2.0</option>
                                                <option value="Client Credentials">Client Credentials</option>
                                            </select>
                                        </div>
                                        <div className="settings-form-group">
                                            <label>API Endpoint URL *</label>
                                            <input
                                                type="text"
                                                placeholder="https://<tenant>.alm.cloud.sap"
                                                value={connectionForm.apiEndpoint}
                                                onChange={e => setConnectionForm({ ...connectionForm, apiEndpoint: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Auth/Token URL *</label>
                                            <input
                                                type="text"
                                                placeholder="https://<tenant>.authentication.../oauth/token"
                                                value={connectionForm.tokenUrl}
                                                onChange={e => setConnectionForm({ ...connectionForm, tokenUrl: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Client ID *</label>
                                            <input
                                                type="text"
                                                placeholder="Client ID"
                                                value={connectionForm.clientId}
                                                onChange={e => setConnectionForm({ ...connectionForm, clientId: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Client Secret *</label>
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                value={connectionForm.clientSecret}
                                                onChange={e => setConnectionForm({ ...connectionForm, clientSecret: e.target.value })}
                                            />
                                        </div>

                                        {/* Test Result Display */}
                                        {testResult && (
                                            <div className={`settings-test-result ${testResult.success ? 'success' : 'error'}`}>
                                                <span className="settings-test-icon">
                                                    {testResult.success ? '✓' : '✗'}
                                                </span>
                                                <span>{testResult.message}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="settings-modal-footer">
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={handleAddSource}
                                            disabled={isSavingConnection}
                                        >
                                            {isSavingConnection ? 'Saving...' : 'Save Connection'}
                                        </button>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={handleTestConnection}
                                            disabled={isTestingConnection}
                                        >
                                            {isTestingConnection ? 'Testing...' : 'Test'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )

            /* ── MANAGE ROLES ───────────────────────── */
            case 'roles':
                return (
                    <div className="settings-section-content">
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">Manage Roles</h2>
                                <p className="settings-section-desc">Define roles and configure their permissions</p>
                            </div>
                        </div>

                        <div className="settings-roles-add">
                            <input
                                type="text"
                                className="settings-roles-input"
                                placeholder="New role name"
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                            />
                            <button className="btn btn-primary" onClick={handleAddRole}>Add Role</button>
                        </div>

                        <div className="settings-roles-grid">
                            {roles.map((role) => (
                                <div key={role.id} className="settings-role-card">
                                    <div className="settings-role-header">
                                        <h3 className="settings-role-name">{role.name}</h3>
                                        <button className="settings-icon-btn danger" title="Delete role" onClick={() => handleDeleteRole(role.id)}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="settings-role-permissions">
                                        {['Read', 'Write', 'Delete', 'Manage Users'].map((perm) => (
                                            <button
                                                key={perm}
                                                className={`settings-permission-badge ${role.permissions.includes(perm) ? 'active' : ''}`}
                                                onClick={() => handleTogglePermission(role.id, perm)}
                                            >
                                                {perm}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )

            /* ── MANAGE AI CREDITS ──────────────────── */
            case 'credits':
                return (
                    <div className="settings-section-content">
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">Credit Usage</h2>
                                <p className="settings-section-desc">Monitor and manage your AI credit consumption</p>
                            </div>
                        </div>

                        <div className="settings-credits-overview">
                            <div className="settings-credits-bar-label">
                                <span>Credits Used</span>
                                <span className="settings-credits-count">7,500 / 10,000</span>
                            </div>
                            <div className="settings-credits-bar-track">
                                <div className="settings-credits-bar-fill" style={{ width: '75%' }} />
                            </div>
                        </div>

                        <div className="settings-credits-breakdown">
                            {creditBreakdown.map((item) => (
                                <div key={item.agent} className="settings-credit-card">
                                    <div className="settings-credit-dot" style={{ background: item.color }} />
                                    <div className="settings-credit-info">
                                        <div className="settings-credit-agent">{item.agent}</div>
                                        <div className="settings-credit-value">{item.credits.toLocaleString()} credits</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="btn btn-primary" style={{ marginTop: 24 }}>
                            Request More Credits
                        </button>
                    </div>
                )

            /* ── USER MANAGEMENT ────────────────────── */
            case 'users':
                return (
                    <div className="settings-section-content">
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">User Management</h2>
                                <p className="settings-section-desc">Manage users and their access to the platform</p>
                            </div>
                        </div>

                        <div className="settings-users-add">
                            <input
                                type="text"
                                placeholder="Full name"
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            />
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                <option value="Admin">Admin</option>
                                <option value="Editor">Editor</option>
                                <option value="Viewer">Viewer</option>
                            </select>
                            <button className="btn btn-primary" onClick={handleAddUser}>Add User</button>
                        </div>

                        <div className="settings-users-list">
                            {users.map((user) => (
                                <div key={user.id} className="settings-user-card">
                                    <div className="settings-user-avatar">
                                        {user.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="settings-user-info">
                                        <div className="settings-user-name">{user.name}</div>
                                        <div className="settings-user-email">{user.email}</div>
                                    </div>
                                    <span className={`settings-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
                                    <span className={`settings-badge status-${user.status.toLowerCase()}`}>{user.status}</span>
                                    <button className="settings-icon-btn danger" title="Remove user" onClick={() => handleDeleteUser(user.id)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            {users.length === 0 && (
                                <div className="settings-empty-state">
                                    <p>No users added yet. Use the form above to add users.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )

            default:
                return null
        }
    }

    /* ── Render ─────────────────────────────────────────── */
    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Configure your AI ecosystem preferences</p>
            </div>

            <div className="settings-layout">
                {/* Left Tab Navigation */}
                <div className="settings-tabs">
                    {settingsTabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="settings-tab-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Right Content */}
                <div className="settings-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
}
