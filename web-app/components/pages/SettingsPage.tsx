'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

/* ─── Tab definitions ──────────────────────────────────── */
const settingsTabs = [
    { id: 'ai-preferences', label: 'AI Preferences', icon: '🤖' },
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
    sourceType: string
    sourceName: string
    authType: string
    clientId: string
    clientSecret: string
    apiEndpoint: string
    tokenUrl: string
}

const emptyConnection: ConnectionForm = {
    sourceType: 'CALM',
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

    /* Auth state */
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string; llm_provider?: string } | null>(null)
    const [isLoadingAuth, setIsLoadingAuth] = useState(true)
    const [selectedLlmProvider, setSelectedLlmProvider] = useState<'openai' | 'claude' | 'gemini'>('openai')
    const [isSavingLlmProvider, setIsSavingLlmProvider] = useState(false)

    /* API key state — values are masked on load, real on edit */
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({ openai: '', claude: '', gemini: '' })
    const [showKey, setShowKey] = useState<Record<string, boolean>>({ openai: false, claude: false, gemini: false })
    /* Per-agent provider preferences */
    const [agentProviders, setAgentProviders] = useState<Record<string, string>>({})
    const [saveMessage, setSaveMessage] = useState('')

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
    const [roles, setRoles] = useState<Role[]>([])
    const [newRoleName, setNewRoleName] = useState('')
    const [isLoadingRoles, setIsLoadingRoles] = useState(false)

    /* Users state */
    const [users, setUsers] = useState<User[]>([])
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Viewer' })
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)

    /* ── Effects ────────────────────────────────────────── */
    useEffect(() => {
        fetchCurrentUser()
    }, [])

    useEffect(() => {
        if (activeTab === 'sources') {
            refreshSources()
        } else if (activeTab === 'roles') {
            refreshRoles()
        } else if (activeTab === 'users') {
            refreshUsers()
        }
    }, [activeTab])

    useEffect(() => {
        if (!showAddConnection) {
            setConnectionForm(emptyConnection)
            setTestResult(null)
        }
    }, [showAddConnection])

    const fetchCurrentUser = async () => {
        setIsLoadingAuth(true)
        try {
            const token = localStorage.getItem('mygo-token')
            if (!token) {
                console.log('No token found in localStorage')
                setIsLoadingAuth(false)
                return
            }

            console.log('Fetching current user with token:', token.substring(0, 20) + '...')
            const res = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
            console.log('Current user fetched:', res.data)
            setCurrentUser(res.data)
            setSelectedLlmProvider((res.data?.llm_provider || 'openai') as 'openai' | 'claude' | 'gemini')
            setApiKeys({ openai: res.data?.api_keys?.openai || '', claude: res.data?.api_keys?.claude || '', gemini: res.data?.api_keys?.gemini || '' })
            setAgentProviders(res.data?.agent_providers || {})
        } catch (err) {
            console.error('Failed to fetch current user:', err)
            localStorage.removeItem('mygo-token')
        } finally {
            setIsLoadingAuth(false)
        }
    }

    const refreshSources = async () => {
        setIsLoadingSources(true)
        try {
            const res = await axios.get('/api/sources')
            setSources(res.data.sources || [])
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        } finally {
            setIsLoadingSources(false)
        }
    }

    const refreshRoles = async () => {
        setIsLoadingRoles(true)
        try {
            const token = localStorage.getItem('mygo-token')
            const res = await axios.get('/api/roles', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            setRoles(res.data.roles || [])
        } catch (err) {
            console.error('Failed to fetch roles:', err)
        } finally {
            setIsLoadingRoles(false)
        }
    }

    const refreshUsers = async () => {
        setIsLoadingUsers(true)
        try {
            const token = localStorage.getItem('mygo-token')
            const res = await axios.get('/api/users', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            setUsers(res.data.users || [])
        } catch (err) {
            console.error('Failed to fetch users:', err)
        } finally {
            setIsLoadingUsers(false)
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
            const response = await axios.post('/api/sources/test-connection', {
                type: connectionForm.sourceType,
                authType: connectionForm.authType,
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
            await axios.post('/api/sources', {
                name: connectionForm.sourceName,
                type: connectionForm.sourceType,
                authType: connectionForm.authType,
                apiEndpoint: connectionForm.apiEndpoint,
                tokenUrl: connectionForm.tokenUrl,
                clientId: connectionForm.clientId,
                clientSecret: connectionForm.clientSecret
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
            await axios.delete(`/api/sources/${id}`)
            await refreshSources()
        } catch (err) {
            console.error('Failed to delete source:', err)
            alert('Failed to delete source')
        }
    }

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return
        try {
            const token = localStorage.getItem('mygo-token')
            await axios.post('/api/roles', {
                name: newRoleName.trim(),
                permissions: ['Read']
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            await refreshRoles()
            setNewRoleName('')
        } catch (err) {
            console.error('Failed to add role:', err)
            alert('Failed to add role')
        }
    }

    const handleDeleteRole = async (id: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return
        try {
            const token = localStorage.getItem('mygo-token')
            await axios.delete(`/api/roles/${id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            await refreshRoles()
        } catch (err) {
            console.error('Failed to delete role:', err)
            alert('Failed to delete role')
        }
    }

    const handleTogglePermission = async (roleId: string, permission: string) => {
        const role = roles.find(r => r.id === roleId)
        if (!role) return

        const has = role.permissions.includes(permission)
        const updatedPermissions = has
            ? role.permissions.filter(p => p !== permission)
            : [...role.permissions, permission]

        try {
            const token = localStorage.getItem('mygo-token')
            await axios.put(`/api/roles/${roleId}`, {
                name: role.name,
                permissions: updatedPermissions
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            await refreshRoles()
        } catch (err) {
            console.error('Failed to update role permissions:', err)
            alert('Failed to update role permissions')
        }
    }

    const handleAddUser = async () => {
        if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) return
        try {
            const token = localStorage.getItem('mygo-token')
            await axios.post('/api/users', {
                name: newUser.name.trim(),
                email: newUser.email.trim(),
                password: newUser.password,
                role: newUser.role
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            await refreshUsers()
            setNewUser({ name: '', email: '', password: '', role: 'Viewer' })
        } catch (err: any) {
            console.error('Failed to add user:', err)
            alert(err.response?.data?.error || 'Failed to add user')
        }
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return
        try {
            const token = localStorage.getItem('mygo-token')
            await axios.delete(`/api/users/${id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            await refreshUsers()
        } catch (err: any) {
            console.error('Failed to delete user:', err)
            alert(err.response?.data?.error || 'Failed to delete user')
        }
    }

    const handleSaveLlmProvider = async () => {
        setIsSavingLlmProvider(true)
        setSaveMessage('')
        try {
            const token = localStorage.getItem('mygo-token')
            await axios.put('/api/auth/preferences', {
                llm_provider: selectedLlmProvider,
                api_keys: apiKeys,
                agent_providers: agentProviders,
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            const stored = localStorage.getItem('mygo-user')
            if (stored) {
                const parsed = JSON.parse(stored)
                parsed.llm_provider = selectedLlmProvider
                localStorage.setItem('mygo-user', JSON.stringify(parsed))
            }
            setCurrentUser(prev => prev ? { ...prev, llm_provider: selectedLlmProvider } : prev)
            // Re-fetch to get masked keys back from server
            await fetchCurrentUser()
            setSaveMessage('Preferences saved successfully.')
            setTimeout(() => setSaveMessage(''), 3000)
        } catch (err: any) {
            console.error('Failed to save LLM provider:', err)
            setSaveMessage(err.response?.data?.error || 'Failed to save preferences.')
        } finally {
            setIsSavingLlmProvider(false)
        }
    }

    /* ── Tab content renderer ──────────────────────────── */
    const renderContent = () => {
        switch (activeTab) {
            case 'ai-preferences': {
                const providers = [
                    { id: 'openai', label: 'OpenAI', logo: '🟢', hint: 'GPT-4.1 · Embeddings · Recommended' },
                    { id: 'claude', label: 'Claude (Anthropic)', logo: '🟠', hint: 'claude-sonnet-4-6 · Long context' },
                    { id: 'gemini', label: 'Gemini (Google)', logo: '🔵', hint: 'gemini-2.5-flash · Multimodal' },
                ] as const
                const agents = [
                    { id: 'ask-yoda', label: 'Ask Yoda' },
                    { id: 'spec-agent', label: 'Spec Agent' },
                    { id: 'test-cases', label: 'Test Case Generator' },
                    { id: 'code-analysis', label: 'Code Analysis' },
                    { id: 'solution-advisor', label: 'Solution Advisor' },
                    { id: 'passage-generator', label: 'Passage Generator' },
                ]
                return (
                    <div className="settings-section-content" style={{ maxWidth: 760 }}>
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">AI Preferences</h2>
                                <p className="settings-section-desc">Configure API keys and choose which LLM powers each agent</p>
                            </div>
                        </div>

                        {/* ── Provider Cards ── */}
                        <h3 className="settings-panel-title" style={{ marginBottom: 10 }}>LLM Providers & API Keys</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                            {providers.map(p => {
                                const isDefault = selectedLlmProvider === p.id
                                const keyVal = apiKeys[p.id] || ''
                                const configured = !!keyVal
                                return (
                                    <div
                                        key={p.id}
                                        style={{
                                            border: isDefault ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                            borderRadius: 10,
                                            padding: '14px 16px',
                                            background: isDefault ? 'rgba(255,104,44,0.05)' : 'var(--glass-bg)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 16,
                                        }}
                                    >
                                        {/* Select as default */}
                                        <input
                                            type="radio"
                                            name="defaultProvider"
                                            checked={isDefault}
                                            onChange={() => setSelectedLlmProvider(p.id)}
                                            style={{ accentColor: 'var(--primary)', width: 17, height: 17, flexShrink: 0 }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontSize: 16 }}>{p.logo}</span>
                                                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</span>
                                                {isDefault && (
                                                    <span style={{ fontSize: 11, background: 'var(--primary)', color: '#fff', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>Default</span>
                                                )}
                                                <span style={{ fontSize: 11, marginLeft: 'auto', color: configured ? '#16a34a' : '#9ca3af' }}>
                                                    {configured ? '● Configured' : '○ No key set'}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginBottom: 8 }}>{p.hint}</p>
                                            {/* API key input */}
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input
                                                    type={showKey[p.id] ? 'text' : 'password'}
                                                    placeholder={`Enter ${p.label} API key`}
                                                    value={keyVal}
                                                    onChange={e => setApiKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    style={{ flex: 1, fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--input-bg, #fff)', fontFamily: 'monospace' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                                    style={{ fontSize: 14, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'transparent', cursor: 'pointer' }}
                                                    title={showKey[p.id] ? 'Hide key' : 'Show key'}
                                                >
                                                    {showKey[p.id] ? '🙈' : '👁️'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Per-agent provider selection ── */}
                        <h3 className="settings-panel-title" style={{ marginBottom: 10 }}>Agent-Level Provider</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                            Override the default provider for individual agents. Leave as &quot;Default&quot; to use the selection above.
                        </p>
                        <div style={{ border: '1px solid var(--glass-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Agent</th>
                                        <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>LLM Provider</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agents.map((agent, i) => (
                                        <tr key={agent.id} style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : undefined }}>
                                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>{agent.label}</td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <select
                                                    value={agentProviders[agent.id] || ''}
                                                    onChange={e => setAgentProviders(prev => ({ ...prev, [agent.id]: e.target.value }))}
                                                    style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--input-bg, #fff)', minWidth: 160 }}
                                                >
                                                    <option value="">Default ({selectedLlmProvider})</option>
                                                    <option value="openai">OpenAI</option>
                                                    <option value="claude">Claude</option>
                                                    <option value="gemini">Gemini</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Save ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveLlmProvider}
                                disabled={isSavingLlmProvider}
                            >
                                {isSavingLlmProvider ? 'Saving...' : 'Save Preferences'}
                            </button>
                            {saveMessage && (
                                <span style={{ fontSize: 13, color: saveMessage.startsWith('Preferences') ? '#16a34a' : '#dc2626' }}>
                                    {saveMessage}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }

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
                                                <div className="settings-source-meta">
                                                    Type: {source.type} · Host: {(() => {
                                                        try {
                                                            return source.config?.apiEndpoint ? new URL(source.config.apiEndpoint).hostname : 'N/A';
                                                        } catch (e) {
                                                            return 'Invalid URL';
                                                        }
                                                    })()}
                                                </div>
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
                                            <label>Source Type *</label>
                                            <select
                                                value={connectionForm.sourceType}
                                                onChange={e => setConnectionForm({ ...connectionForm, sourceType: e.target.value })}
                                            >
                                                <option value="CALM">SAP Cloud ALM</option>
                                                <option value="BTP">SAP BTP</option>
                                                <option value="SharePoint">SharePoint</option>
                                                <option value="JIRA">JIRA</option>
                                            </select>
                                        </div>
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
                                                <option value="Basic Authentication">Basic Authentication</option>
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
                                            <label>{connectionForm.authType === 'Basic Authentication' ? 'Username / Client ID *' : 'Client ID *'}</label>
                                            <input
                                                type="text"
                                                placeholder={connectionForm.authType === 'Basic Authentication' ? "Username" : "Client ID"}
                                                value={connectionForm.clientId}
                                                onChange={e => setConnectionForm({ ...connectionForm, clientId: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>{connectionForm.authType === 'Basic Authentication' ? 'Password / Client Secret *' : 'Client Secret *'}</label>
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

                        {isLoadingRoles ? (
                            <div className="p-8 text-center text-gray-500">Loading roles...</div>
                        ) : (
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
                                {roles.length === 0 && (
                                    <div className="settings-empty-state">
                                        <p>No roles configured yet. Add a role to get started.</p>
                                    </div>
                                )}
                            </div>
                        )}
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
                            <input
                                type="password"
                                placeholder="Password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            />
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                {roles.map(role => (
                                    <option key={role.id} value={role.name}>{role.name}</option>
                                ))}
                            </select>
                            <button className="btn btn-primary" onClick={handleAddUser}>Add User</button>
                        </div>

                        {isLoadingUsers ? (
                            <div className="p-8 text-center text-gray-500">Loading users...</div>
                        ) : (
                            <div className="settings-users-list">
                                {users.map((user) => {
                                    const isCurrentUser = currentUser?.id === user.id
                                    const isAdminUser = user.role === 'Admin'
                                    const canDelete = !isCurrentUser && !isAdminUser

                                    return (
                                        <div key={user.id} className="settings-user-card">
                                            <div className="settings-user-avatar">
                                                {user.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div className="settings-user-info">
                                                <div className="settings-user-name">
                                                    {user.name}
                                                    {isCurrentUser && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>(You)</span>}
                                                </div>
                                                <div className="settings-user-email">{user.email}</div>
                                            </div>
                                            <span className={`settings-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
                                            <span className={`settings-badge status-${user.status.toLowerCase()}`}>{user.status}</span>
                                            {canDelete ? (
                                                <button className="settings-icon-btn danger" title="Remove user" onClick={() => handleDeleteUser(user.id)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <div style={{ width: 32 }} />
                                            )}
                                        </div>
                                    )
                                })}
                                {users.length === 0 && (
                                    <div className="settings-empty-state">
                                        <p>No users added yet. Use the form above to add users.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )

            default:
                return null
        }
    }

    /* ── Render ─────────────────────────────────────────── */
    const isAdmin = currentUser?.role === 'Admin'

    console.log('Current user:', currentUser)
    console.log('Is admin:', isAdmin)

    // Filter tabs based on user role
    const visibleTabs = settingsTabs.filter(tab => {
        if (tab.id === 'roles' || tab.id === 'users') {
            return isAdmin
        }
        return true
    })

    console.log('Visible tabs:', visibleTabs.map(t => t.id))

    if (isLoadingAuth) {
        return (
            <div className="settings-page">
                <div className="p-8 text-center text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Configure your AI ecosystem preferences</p>
            </div>

            <div className="settings-layout">
                {/* Left Tab Navigation */}
                <div className="settings-tabs">
                    {visibleTabs.map((tab) => (
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
