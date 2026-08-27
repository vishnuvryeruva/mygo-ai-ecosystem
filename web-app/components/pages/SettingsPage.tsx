'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import ObservabilityPanel from './ObservabilityPanel'

/* ─── Tab definitions ──────────────────────────────────── */
const settingsTabs = [
    { id: 'ai-preferences', label: 'AI Preferences', icon: '🤖' },
    { id: 'prompts', label: 'Manage Prompts', icon: '💬' },
    { id: 'sources', label: 'Manage Sources', icon: '⚙️' },
    { id: 'sap-adt-mcp', label: 'SAP ADT MCP Credentials', icon: '🔌' },
    { id: 'roles', label: 'Manage Roles', icon: '🔑' },
    { id: 'credits', label: 'AI Observability', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
]

/* ─── Prompts data ─────────────────────────────────────── */
const aiScenarios = [
    { id: 'ask-yoda', title: 'Ask Yoda - RAG Q&A', subtitle: 'System prompt used for answering questions using RAG (Retrieval Augmented Generation)', active: true },
    { id: 'solution-advisor', title: 'Solution Advisor Agent', subtitle: 'System prompt used for gathering requirements and producing solution guidance', active: true },
    { id: 'code-quality', title: 'Code Quality Advisor', subtitle: 'Prompts for code quality analysis and recommendations', active: false },
    { id: 'code-explanation', title: 'Code Explanation', subtitle: 'Prompts for explaining code functionality', active: false },
    { id: 'llm-prompt', title: 'LLM Prompt Generator', subtitle: 'Prompts for generating optimized LLM prompts for code generation', active: false },
    { id: 'func-spec', title: 'Functional Specification Generator', subtitle: 'Prompts for generating functional specification documents', active: false },
    { id: 'tech-spec', title: 'Technical Specification Generator', subtitle: 'Prompts for generating technical specification documents', active: false },
]

const defaultSystemPrompts: Record<string, string> = {
    'ask-yoda': `You are Yoda, a wise AI assistant with access to a knowledge base of SAP documents, specifications, blueprints, and test cases. Provide accurate, helpful answers based on the provided context.
If the context doesn't contain enough information, say so clearly.
Always cite relevant documents when answering.`,
    'solution-advisor': `You are an expert SAP Solution Architect helping users design solutions.
Your PRIMARY goal is to PROVIDE ANSWERS AND SOLUTIONS, not to ask questions.

When a user describes their requirements:
1. Acknowledge their requirements and provide a concise initial solution approach (3-5 sentences)
2. Include specific SAP recommendations: modules, transactions, BAPIs, or function modules
3. ONLY set needs_clarification to true if a CRITICAL piece of information is missing that would fundamentally change the solution

RULES:
- If requirements are at least 60% clear, proceed with a solution and note assumptions
- If you must ask, ask only ONE critical question
- Keep the response concise — the full detailed solution is generated in the next step
- Default to needs_clarification: false

You MUST return a JSON object with these three keys:
  "needs_clarification": a boolean, true or false
  "clarifications": plain text only — your concise solution approach or clarifying question. NEVER put JSON, code blocks, or markdown fences inside this field.
  "summary": plain text only — one sentence describing the requirement`,
}

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
    sapClient?: string
}

const emptyConnection: ConnectionForm = {
    sourceType: 'CALM',
    sourceName: '',
    authType: 'OAuth 2.0',
    clientId: '',
    clientSecret: '',
    apiEndpoint: '',
    tokenUrl: '',
    sapClient: '300',
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
    /* Per-agent provider preferences & available models */
    const [agentProviders, setAgentProviders] = useState<Record<string, string>>({})
    const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({ openai: [], claude: [], gemini: [] })
    const [selectedModels, setSelectedModels] = useState<Record<string, string>>({ openai: 'gpt-4o', claude: 'claude-3-5-sonnet-20241022', gemini: 'gemini-2.5-flash' })
    const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({ openai: false, claude: false, gemini: false })
    const [saveMessage, setSaveMessage] = useState('')

    const handleFetchModels = async (providerId: string) => {
        setFetchingModels(prev => ({ ...prev, [providerId]: true }))
        try {
            const token = localStorage.getItem('mygo-token')
            const apiKey = apiKeys[providerId] || ''
            const res = await axios.post('/api/llm/models', {
                provider: providerId,
                api_key: apiKey
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            if (res.data.success && Array.isArray(res.data.models)) {
                setAvailableModels(prev => ({ ...prev, [providerId]: res.data.models }))
                if (res.data.models.length > 0 && !selectedModels[providerId]) {
                    setSelectedModels(prev => ({ ...prev, [providerId]: res.data.models[0] }))
                }
                setSaveMessage(`Fetched ${res.data.models.length} available models for ${providerId.toUpperCase()}.`)
                setTimeout(() => setSaveMessage(''), 3000)
            }
        } catch (err: any) {
            console.error(`Failed to fetch models for ${providerId}:`, err)
            alert(err?.response?.data?.error || `Could not fetch models for ${providerId}`)
        } finally {
            setFetchingModels(prev => ({ ...prev, [providerId]: false }))
        }
    }

    /* Prompts state */
    const [activeScenario, setActiveScenario] = useState('ask-yoda')
    const [scenarioPrompts, setScenarioPrompts] = useState<Record<string, string>>(defaultSystemPrompts)
    const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompts['ask-yoda'])

    /* Sources state */
    const [sources, setSources] = useState<Source[]>([])
    const [showAddConnection, setShowAddConnection] = useState(false)
    const [connectionForm, setConnectionForm] = useState<ConnectionForm>(emptyConnection)
    const [isLoadingSources, setIsLoadingSources] = useState(false)
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [isSavingConnection, setIsSavingConnection] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    /* SAP ADT MCP Credentials State */
    const [mcpDescription, setMcpDescription] = useState('')
    const [mcpSystemId, setMcpSystemId] = useState('')
    const [mcpAppServer, setMcpAppServer] = useState('')
    const [mcpInstanceNo, setMcpInstanceNo] = useState('')
    const [mcpHttpsPort, setMcpHttpsPort] = useState('')
    const [mcpSaprouterString, setMcpSaprouterString] = useState('')
    const [mcpSapClient, setMcpSapClient] = useState('')
    const [mcpUsername, setMcpUsername] = useState('')
    const [mcpPassword, setMcpPassword] = useState('')

    const [mcpShowPassword, setMcpShowPassword] = useState(false)
    const [mcpDestination, setMcpDestination] = useState('')
    const [mcpTesting, setMcpTesting] = useState(false)
    const [mcpSaving, setMcpSaving] = useState(false)
    const [mcpSaveMessage, setMcpSaveMessage] = useState('')
    const [mcpTestResult, setMcpTestResult] = useState<{
        success: boolean
        message: string
        destinations?: any[]
        endpoint?: string
    } | null>(null)

    /* ADT Tool Test Bench State */
    const [activeToolTab, setActiveToolTab] = useState<'FETCH_CODE' | 'RUN_UNIT_TESTS' | 'RUN_ATC' | 'DESTINATIONS'>('FETCH_CODE')
    const [testObjectName, setTestObjectName] = useState('CL_ABAP_TYPEDESCR')
    const [testObjectType, setTestObjectType] = useState<'CLASS' | 'PROGRAM'>('CLASS')
    const [isExecutingTool, setIsExecutingTool] = useState(false)
    const [toolResult, setToolResult] = useState<any>(null)
    const [toolError, setToolError] = useState<string>('')



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
        if (activeTab === 'sap-adt-mcp') {
            refreshMcpSettings()
        } else if (activeTab === 'sources') {
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

    useEffect(() => {
        setSystemPrompt(scenarioPrompts[activeScenario] || '')
    }, [activeScenario, scenarioPrompts])

    const fetchCurrentUser = async () => {
        setIsLoadingAuth(true)
        try {
            const token = localStorage.getItem('mygo-token')
            if (!token) {
                setIsLoadingAuth(false)
                return
            }

            const res = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
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

    const computeEffectiveSapUrl = (server: string, inst: string, portOverride: string) => {
        let s = (server || '').trim()
        if (!s) return ''
        if (!s.startsWith('http://') && !s.startsWith('https://')) {
            s = `https://${s}`
        }
        if (!s.includes(':', 6)) {
            const p = portOverride.trim() || (inst.trim() ? `443${inst.trim()}` : '44300')
            s = `${s}:${p}`
        }
        return s
    }

    const refreshMcpSettings = async () => {
        try {
            const token = localStorage.getItem('mygo-token') || localStorage.getItem('token')
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const res = await axios.get('/api/sources', { headers })
            const sourceList: Source[] = res.data.sources || []
            const mcpSource = sourceList.find(s => s.type === 'SAP_ADT_MCP' || s.type === 'SAP_ADT')
            if (mcpSource) {
                const sourceDetailRes = await axios.get(`/api/sources/${mcpSource.id}`, { headers })
                const detail = sourceDetailRes.data || {}
                const cfg = detail.config || {}
                if (cfg.description) setMcpDescription(cfg.description)
                if (cfg.systemId) setMcpSystemId(cfg.systemId)
                if (cfg.appServer) setMcpAppServer(cfg.appServer)
                if (cfg.instanceNo) setMcpInstanceNo(cfg.instanceNo)
                if (cfg.httpsPort) setMcpHttpsPort(cfg.httpsPort)
                if (cfg.saprouterString || cfg.routerString) setMcpSaprouterString(cfg.saprouterString || cfg.routerString)
                if (cfg.sapClient) setMcpSapClient(cfg.sapClient)
                if (cfg.username) setMcpUsername(cfg.username)
                if (cfg.apiEndpoint && !cfg.appServer) setMcpAppServer(cfg.apiEndpoint)
                if (cfg.destination) setMcpDestination(cfg.destination)
            }
        } catch (err) {
            console.error('Failed to load MCP settings:', err)
        }
    }


    const handleApplyPreset = (preset: 'HMT' | 'HMF' | 'HMP' | 'MSP' | 'HMD' | 'CUSTOM') => {
        if (preset === 'HMT') {
            // HMT: VPN-only private system. Must route through SAProuter.
            setMcpDescription('HMT S4 HANA 2021 (VPN)')
            setMcpSystemId('HMT')
            setMcpAppServer('192.168.171.43')
            setMcpInstanceNo('00')
            setMcpHttpsPort('44300')
            setMcpSaprouterString('/H/50.198.15.124/H/')
            setMcpSapClient('300')
        } else if (preset === 'HMF') {
            // HMF: Port 44330 on Web Dispatcher (confirmed via port scan)
            setMcpDescription('HMF S4 HANA Fun (Public)')
            setMcpSystemId('HMF')
            setMcpAppServer('mygowebdisp.mygoconsulting.com')
            setMcpInstanceNo('30')
            setMcpHttpsPort('44330')
            setMcpSaprouterString('')
            setMcpSapClient('300')
        } else if (preset === 'HMP') {
            // HMP: Port 44320 on Web Dispatcher (confirmed via port scan)
            setMcpDescription('HMP S4 HANA (Public)')
            setMcpSystemId('HMP')
            setMcpAppServer('mygowebdisp.mygoconsulting.com')
            setMcpInstanceNo('20')
            setMcpHttpsPort('44320')
            setMcpSaprouterString('')
            setMcpSapClient('300')
        } else if (preset === 'MSP') {
            // MSP: Port 44300 on Web Dispatcher (confirmed via port scan)
            setMcpDescription('MSP S4 HANA (Public)')
            setMcpSystemId('MSP')
            setMcpAppServer('mygowebdisp.mygoconsulting.com')
            setMcpInstanceNo('00')
            setMcpHttpsPort('44300')
            setMcpSaprouterString('')
            setMcpSapClient('300')
        } else if (preset === 'HMD') {
            // HMD: Port 44350 on Web Dispatcher (confirmed via port scan)
            setMcpDescription('HMD S4 HANA Dev (Public)')
            setMcpSystemId('HMD')
            setMcpAppServer('mygowebdisp.mygoconsulting.com')
            setMcpInstanceNo('50')
            setMcpHttpsPort('44350')
            setMcpSaprouterString('')
            setMcpSapClient('300')
        }
    }

    const handleTestMcpConnection = async () => {
        setMcpTesting(true)
        setMcpTestResult(null)
        try {
            const token = localStorage.getItem('mygo-token') || localStorage.getItem('token')
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const effectiveUrl = computeEffectiveSapUrl(mcpAppServer, mcpInstanceNo, mcpHttpsPort)
            
            const payload = {
                mode: 'DIRECT_SAP',
                sapHost: effectiveUrl,
                sapClient: mcpSapClient,
                sapRouter: mcpSaprouterString,
                systemId: mcpSystemId,
                instanceNo: mcpInstanceNo,
                username: mcpUsername,
                password: mcpPassword,
                destination: mcpDestination
            }
            
            const res = await axios.post('/api/sap/mcp/test-connection', payload, { headers })

            if (res.data.success) {
                const dests = res.data.destinations || []
                const formattedDests = Array.isArray(dests)
                    ? dests.map((d: any) => typeof d === 'string' ? d : (d.name || d.destination || JSON.stringify(d)))
                    : []
                setMcpTestResult({
                    success: true,
                    message: res.data.message || `Successfully authenticated with SAP ${mcpSystemId}!`,
                    destinations: formattedDests,
                    endpoint: res.data.endpoint || effectiveUrl
                })
            } else {
                setMcpTestResult({
                    success: false,
                    message: res.data.error || 'Could not authenticate with SAP ADT'
                })
            }
        } catch (err: any) {
            console.error('Error testing connection:', err)
            setMcpTestResult({
                success: false,
                message: err?.response?.data?.error || err.message || 'Could not reach SAP ADT System'
            })
        } finally {
            setMcpTesting(false)
        }
    }


    const handleSaveMcpSettings = async () => {
        setMcpSaving(true)
        setMcpSaveMessage('')
        try {
            const token = localStorage.getItem('mygo-token') || localStorage.getItem('token')
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            
            const res = await axios.get('/api/sources', { headers })
            const sourceList: Source[] = res.data.sources || []
            const existingMcp = sourceList.find(s => s.type === 'SAP_ADT_MCP' || s.type === 'SAP_ADT')
            
            const effectiveUrl = computeEffectiveSapUrl(mcpAppServer, mcpInstanceNo, mcpHttpsPort)

            // NOTE: Password is NEVER saved to permanent database
            const payload = {
                sourceType: 'SAP_ADT_MCP',
                sourceName: mcpDescription || 'SAP ADT Direct Connection',
                authType: 'Basic Auth',
                mode: 'DIRECT_SAP',
                description: mcpDescription,
                systemId: mcpSystemId,
                appServer: mcpAppServer,
                instanceNo: mcpInstanceNo,
                httpsPort: mcpHttpsPort,
                saprouterString: mcpSaprouterString,
                sapHost: effectiveUrl,
                sapClient: mcpSapClient,
                username: mcpUsername,
                password: '', // ZERO STORAGE GUARANTEE: Never store password in DB
                apiEndpoint: effectiveUrl,
                destination: mcpDestination
            }
            
            if (existingMcp) {
                await axios.put(`/api/sources/${existingMcp.id}`, payload, { headers })
            } else {
                await axios.post('/api/sources', payload, { headers })
            }

            // Cache password in sessionStorage for current browser session
            if (mcpPassword && typeof window !== 'undefined') {
                sessionStorage.setItem('mygo_ephemeral_sap_creds', JSON.stringify({
                    sapHost: effectiveUrl,
                    sapRouter: mcpSaprouterString,
                    sapClient: mcpSapClient,
                    username: mcpUsername,
                    password: mcpPassword
                }))
            }
            
            setMcpSaveMessage('Configuration saved!')
            setTimeout(() => setMcpSaveMessage(''), 4000)
        } catch (err: any) {
            console.error('Error saving MCP settings:', err)
            alert(err?.response?.data?.error || 'Failed to save SAP ADT Configuration')
        } finally {
            setMcpSaving(false)
        }
    }

    const handleExecuteAdtTool = async () => {
        setIsExecutingTool(true)
        setToolResult(null)
        setToolError('')
        
        try {
            const token = localStorage.getItem('mygo-token') || localStorage.getItem('token')
            const headers = token ? { Authorization: `Bearer ${token}` } : {}
            const effectiveUrl = computeEffectiveSapUrl(mcpAppServer, mcpInstanceNo, mcpHttpsPort)
            const ephemeralCreds = {
                sapHost: effectiveUrl,
                sapClient: mcpSapClient,
                username: mcpUsername,
                password: mcpPassword,
                sapRouter: mcpSaprouterString
            }
            
            if (activeToolTab === 'FETCH_CODE') {
                const res = await axios.post('/api/sap/mcp/fetch-code', {
                    object_name: testObjectName,
                    object_type: testObjectType,
                    sap_credentials: ephemeralCreds
                }, { headers })
                setToolResult(res.data)
            } else if (activeToolTab === 'RUN_UNIT_TESTS') {
                const res = await axios.post('/api/sap/mcp/call-tool', {
                    tool_name: 'abap_run_unit_tests',
                    arguments: { objectUri: testObjectName },
                    sap_credentials: ephemeralCreds
                }, { headers })
                setToolResult(res.data)
            } else if (activeToolTab === 'RUN_ATC') {
                const res = await axios.post('/api/sap/mcp/run-atc', {
                    object_name: testObjectName,
                    sap_credentials: ephemeralCreds
                }, { headers })
                setToolResult(res.data)
            } else if (activeToolTab === 'DESTINATIONS') {
                const res = await axios.post('/api/sap/mcp/destinations', {
                    sap_credentials: ephemeralCreds
                }, { headers })
                setToolResult(res.data)
            }
        } catch (err: any) {
            console.error('ADT Tool execution error:', err)
            setToolError(err?.response?.data?.error || err.message || 'Failed to execute tool on SAP ADT')
        } finally {
            setIsExecutingTool(false)
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
        if (connectionForm.sourceType === 'SAP_ADT') {
            if (!connectionForm.apiEndpoint || !connectionForm.clientId || !connectionForm.clientSecret) {
                setTestResult({ success: false, message: 'Please fill in Host/Endpoint, Username, and Password' })
                return
            }
        } else if (!connectionForm.apiEndpoint || !connectionForm.tokenUrl || !connectionForm.clientId || !connectionForm.clientSecret) {
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
                clientSecret: connectionForm.clientSecret,
                sapClient: connectionForm.sapClient
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
                clientSecret: connectionForm.clientSecret,
                sapClient: connectionForm.sapClient
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
                                            {/* API key input & Fetch Models Button */}
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
                                                <button
                                                    type="button"
                                                    onClick={() => handleFetchModels(p.id)}
                                                    disabled={fetchingModels[p.id]}
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        padding: '6px 12px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--primary)',
                                                        background: 'var(--primary)',
                                                        color: '#fff',
                                                        cursor: fetchingModels[p.id] ? 'wait' : 'pointer',
                                                        opacity: fetchingModels[p.id] ? 0.7 : 1,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {fetchingModels[p.id] ? '⏳ Fetching...' : '🔍 Fetch Models'}
                                                </button>
                                            </div>

                                            {/* Preferred Model Dropdown */}
                                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.02)', padding: '6px 10px', borderRadius: 6, border: '1px border-slate-100' }}>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Preferred Model:
                                                </label>
                                                <select
                                                    value={selectedModels[p.id] || ''}
                                                    onChange={e => setSelectedModels(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--input-bg, #fff)' }}
                                                >
                                                    {availableModels[p.id] && availableModels[p.id].length > 0 ? (
                                                        availableModels[p.id].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))
                                                    ) : (
                                                        <option value={selectedModels[p.id] || (p.id === 'openai' ? 'gpt-4o' : p.id === 'gemini' ? 'gemini-2.5-flash' : 'claude-3-5-sonnet-20241022')}>
                                                            {selectedModels[p.id] || (p.id === 'openai' ? 'gpt-4o' : p.id === 'gemini' ? 'gemini-2.5-flash' : 'claude-3-5-sonnet-20241022')} (Default)
                                                        </option>
                                                    )}
                                                </select>
                                                {availableModels[p.id] && availableModels[p.id].length > 0 && (
                                                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                                                        ✓ {availableModels[p.id].length} models fetched
                                                    </span>
                                                )}
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
                                onChange={(e) => {
                                    const nextPrompt = e.target.value
                                    setSystemPrompt(nextPrompt)
                                    setScenarioPrompts(prev => ({ ...prev, [activeScenario]: nextPrompt }))
                                }}
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
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setConnectionForm({
                                                        ...connectionForm,
                                                        sourceType: val,
                                                        authType: val === 'SAP_ADT' ? 'Basic Authentication' : connectionForm.authType
                                                    });
                                                }}
                                            >
                                                <option value="CALM">SAP Cloud ALM</option>
                                                <option value="BTP">SAP BTP</option>
                                                <option value="SAP_ADT">SAP ADT Direct Connection</option>
                                                <option value="SAP_ADT_MCP">SAP ADT MCP Server (Local/Remote)</option>
                                                <option value="SharePoint">SharePoint</option>
                                                <option value="JIRA">JIRA</option>
                                            </select>
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Source Name *</label>
                                            <input
                                                type="text"
                                                placeholder={connectionForm.sourceType === 'SAP_ADT' ? "e.g. Mygo SAP ADT" : "e.g. Mygo Cloud ALM"}
                                                value={connectionForm.sourceName}
                                                onChange={e => setConnectionForm({ ...connectionForm, sourceName: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>Authentication Type *</label>
                                            <select
                                                value={connectionForm.authType}
                                                onChange={e => setConnectionForm({ ...connectionForm, authType: e.target.value })}
                                                disabled={connectionForm.sourceType === 'SAP_ADT'}
                                            >
                                                <option value="OAuth 2.0">OAuth 2.0</option>
                                                <option value="Client Credentials">Client Credentials</option>
                                                <option value="Basic Authentication">Basic Authentication</option>
                                            </select>
                                        </div>
                                        {connectionForm.sourceType === 'SAP_ADT' && (
                                            <div className="settings-form-group">
                                                <label>SAP System Preset</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        style={{
                                                            fontSize: 11,
                                                            padding: '6px 8px',
                                                            fontWeight: 600,
                                                            border: connectionForm.sapClient === '300' && connectionForm.apiEndpoint.includes('171.43') ? '2px solid #FF682C' : '1px solid var(--glass-border)',
                                                            background: connectionForm.sapClient === '300' && connectionForm.apiEndpoint.includes('171.43') ? 'rgba(255,104,44,0.1)' : undefined
                                                        }}
                                                        onClick={() => setConnectionForm({
                                                            ...connectionForm,
                                                            sourceName: 'SAP S/4HANA (HMT)',
                                                            apiEndpoint: 'https://192.168.171.43:44300',
                                                            sapClient: '300'
                                                        })}
                                                    >
                                                        ⚡ HMT (Client 300)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        style={{
                                                            fontSize: 11,
                                                            padding: '6px 8px',
                                                            fontWeight: 600,
                                                            border: connectionForm.sapClient === '300' && connectionForm.apiEndpoint.includes('mygohanafun') ? '2px solid #FF682C' : '1px solid var(--glass-border)',
                                                            background: connectionForm.sapClient === '300' && connectionForm.apiEndpoint.includes('mygohanafun') ? 'rgba(255,104,44,0.1)' : undefined
                                                        }}
                                                        onClick={() => setConnectionForm({
                                                            ...connectionForm,
                                                            sourceName: 'SAP HANA Fun (HMF)',
                                                            apiEndpoint: 'https://mygohanafun.mygoconsulting.com:44300',
                                                            sapClient: '300'
                                                        })}
                                                    >
                                                        ⚡ HMF (Client 300)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        style={{
                                                            fontSize: 11,
                                                            padding: '6px 8px',
                                                            fontWeight: 600,
                                                            border: connectionForm.apiEndpoint.includes('mygowebdisp') ? '2px solid #FF682C' : '1px solid var(--glass-border)',
                                                            background: connectionForm.apiEndpoint.includes('mygowebdisp') ? 'rgba(255,104,44,0.1)' : undefined
                                                        }}
                                                        onClick={() => setConnectionForm({
                                                            ...connectionForm,
                                                            sourceName: 'SAP Web Dispatcher (MSP)',
                                                            apiEndpoint: 'https://mygowebdisp.mygoconsulting.com:44300',
                                                            sapClient: '300'
                                                        })}
                                                    >
                                                        🌐 WebDisp (MSP)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="settings-form-group">
                                            <label>{connectionForm.sourceType === 'SAP_ADT' ? 'SAP ADT Endpoint Host URL *' : 'API Endpoint URL *'}</label>
                                            <input
                                                type="text"
                                                placeholder={connectionForm.sourceType === 'SAP_ADT' ? "https://192.168.171.43:44300" : "https://<tenant>.alm.cloud.sap"}
                                                value={connectionForm.apiEndpoint}
                                                onChange={e => setConnectionForm({ ...connectionForm, apiEndpoint: e.target.value })}
                                            />
                                        </div>
                                        {connectionForm.sourceType !== 'SAP_ADT' && (
                                            <div className="settings-form-group">
                                                <label>Auth/Token URL *</label>
                                                <input
                                                    type="text"
                                                    placeholder="https://<tenant>.authentication.../oauth/token"
                                                    value={connectionForm.tokenUrl}
                                                    onChange={e => setConnectionForm({ ...connectionForm, tokenUrl: e.target.value })}
                                                />
                                            </div>
                                        )}
                                        {connectionForm.sourceType === 'SAP_ADT' && (
                                            <div className="settings-form-group">
                                                <label>SAP Client ID *</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 300"
                                                    value={connectionForm.sapClient || ''}
                                                    onChange={e => setConnectionForm({ ...connectionForm, sapClient: e.target.value })}
                                                />
                                            </div>
                                        )}
                                        <div className="settings-form-group">
                                            <label>
                                                {connectionForm.sourceType === 'SAP_ADT'
                                                    ? 'SAP Developer Username *'
                                                    : connectionForm.authType === 'Basic Authentication'
                                                        ? 'Username / Client ID *'
                                                        : 'Client ID *'}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={connectionForm.sourceType === 'SAP_ADT' ? "e.g. DEVELOPER" : connectionForm.authType === 'Basic Authentication' ? "Username" : "Client ID"}
                                                value={connectionForm.clientId}
                                                onChange={e => setConnectionForm({ ...connectionForm, clientId: e.target.value })}
                                            />
                                        </div>
                                        <div className="settings-form-group">
                                            <label>
                                                {connectionForm.sourceType === 'SAP_ADT'
                                                    ? 'SAP Developer Password *'
                                                    : connectionForm.authType === 'Basic Authentication'
                                                        ? 'Password / Client Secret *'
                                                        : 'Client Secret *'}
                                            </label>
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

            case 'credits':
                return <ObservabilityPanel />

            case 'sap-adt-mcp':
                return (
                    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* ── Page Header Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #fff7f3 100%)',
                            border: '1px solid rgba(255,104,44,0.2)',
                            borderRadius: 16,
                            padding: '24px 28px',
                            boxShadow: '0 4px 20px rgba(255,104,44,0.06)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12,
                                        background: 'linear-gradient(135deg, #FF682C 0%, #d64a13 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 24, color: '#fff', boxShadow: '0 4px 14px rgba(255,104,44,0.35)'
                                    }}>🔌</div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1B2426', letterSpacing: '-0.02em' }}>
                                            SAP System Connection
                                        </h2>
                                        <p style={{ margin: 0, fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                            Direct REST API connection for ABAP Development Tools (ADT) & Agent Workflows
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', borderRadius: 20,
                                        background: mcpTestResult?.success ? '#f0fdf4' : '#f8fafc',
                                        border: mcpTestResult?.success ? '1px solid #86efac' : '1px solid #e2e8f0'
                                    }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: mcpTestResult?.success ? '#16a34a' : '#94a3b8'
                                        }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: mcpTestResult?.success ? '#15803d' : '#64748b' }}>
                                            {mcpTestResult?.success ? 'ADT CONNECTED' : 'NOT CONNECTED'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── System Connection Parameters & Logon Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            
                            {/* Step 1: System Parameters */}
                            <div style={{
                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                                overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column'
                            }}>
                                <div style={{
                                    padding: '14px 18px',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    borderBottom: '1px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', gap: 10
                                }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 6, background: '#FF682C', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 800
                                    }}>1</div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>System Parameters</span>
                                </div>
                                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Description</label>
                                        <input type="text" value={mcpDescription}
                                            onChange={e => setMcpDescription(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>System ID</label>
                                            <input type="text" value={mcpSystemId}
                                                onChange={e => setMcpSystemId(e.target.value.toUpperCase())}
                                                maxLength={3}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Instance No.</label>
                                            <input type="text" value={mcpInstanceNo}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                                    setMcpInstanceNo(val)
                                                    if (val.length === 2) setMcpHttpsPort(`443${val}`)
                                                }}
                                                maxLength={2}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Application Server (Host / IP)</label>
                                        <input type="text" value={mcpAppServer}
                                            onChange={e => setMcpAppServer(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Client</label>
                                            <input type="text" value={mcpSapClient}
                                                onChange={e => setMcpSapClient(e.target.value)}
                                                maxLength={3}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>HTTPS Port</label>
                                            <input type="text" value={mcpHttpsPort}
                                                onChange={e => setMcpHttpsPort(e.target.value)}
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Logon Credentials */}
                            <div style={{
                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                                overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column'
                            }}>
                                <div style={{
                                    padding: '14px 18px',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    borderBottom: '1px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: 6,
                                            background: mcpTestResult?.success ? '#16a34a' : '#64748b',
                                            color: '#fff', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', fontSize: 12, fontWeight: 800
                                        }}>{mcpTestResult?.success ? '✓' : '2'}</div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Logon Credentials</span>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: 'rgba(22,163,74,0.08)', padding: '3px 8px', borderRadius: 12, border: '1px solid rgba(22,163,74,0.2)' }}>
                                        🔐 SESSION ONLY
                                    </span>
                                </div>
                                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>User ID</label>
                                        <input type="text" value={mcpUsername}
                                            onChange={e => setMcpUsername(e.target.value.toUpperCase())}
                                            autoComplete="username"
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, textTransform: 'uppercase', border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Password</label>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <input
                                                type={mcpShowPassword ? 'text' : 'password'}
                                                value={mcpPassword}
                                                onChange={e => { setMcpPassword(e.target.value); if (mcpTestResult) setMcpTestResult(null) }}
                                                autoComplete="current-password"
                                                style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', color: '#1e293b', background: '#f8fafc' }}
                                            />
                                            <button type="button" onClick={() => setMcpShowPassword(!mcpShowPassword)}
                                                style={{ padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: 13 }}
                                            >{mcpShowPassword ? '🙈' : '👁️'}</button>
                                        </div>
                                        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
                                            Password is held in browser memory only and never persisted to the database.
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
                                        <button
                                            type="button"
                                            onClick={handleTestMcpConnection}
                                            disabled={mcpTesting || !mcpUsername || !mcpPassword}
                                            style={{
                                                flex: 1, padding: '10px 16px', borderRadius: 8,
                                                border: '1.5px solid rgba(255,104,44,0.5)',
                                                background: (!mcpUsername || !mcpPassword) ? '#f8fafc' : '#fff5f0',
                                                color: (!mcpUsername || !mcpPassword) ? '#94a3b8' : '#d64a13',
                                                fontSize: 13, fontWeight: 700,
                                                cursor: (!mcpUsername || !mcpPassword) ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                opacity: (!mcpUsername || !mcpPassword) ? 0.5 : 1
                                            }}
                                        >
                                            {mcpTesting ? '🔍 Testing...' : '🔍 Test Connection'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={async () => { if (!mcpTestResult?.success) return; await handleSaveMcpSettings() }}
                                            disabled={mcpSaving || !mcpTestResult?.success}
                                            style={{
                                                flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                                                background: mcpTestResult?.success ? 'linear-gradient(135deg, #FF682C 0%, #d64a13 100%)' : '#e2e8f0',
                                                color: mcpTestResult?.success ? '#fff' : '#94a3b8',
                                                fontSize: 13, fontWeight: 700,
                                                cursor: mcpTestResult?.success ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                boxShadow: mcpTestResult?.success ? '0 4px 14px rgba(255,104,44,0.35)' : 'none'
                                            }}
                                        >
                                            {mcpSaving ? '💾 Saving...' : '💾 Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Test Status Banner */}
                        {mcpTestResult && (
                            <div style={{
                                padding: '14px 18px', borderRadius: 10,
                                border: mcpTestResult.success ? '1px solid #86efac' : '1px solid #fca5a5',
                                background: mcpTestResult.success ? '#f0fdf4' : '#fef2f2',
                                display: 'flex', alignItems: 'flex-start', gap: 12
                            }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{mcpTestResult.success ? '✅' : '❌'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: mcpTestResult.success ? '#15803d' : '#991b1b' }}>
                                        {mcpTestResult.success ? `Connected to SAP ${mcpSystemId} (Client ${mcpSapClient})` : 'Connection Failed'}
                                    </div>
                                    <div style={{ fontSize: 12, color: mcpTestResult.success ? '#166534' : '#b91c1c', marginTop: 2 }}>
                                        {mcpTestResult.message}
                                    </div>
                                </div>
                                {mcpSaveMessage && (
                                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, alignSelf: 'center' }}>✓ {mcpSaveMessage}</span>
                                )}
                            </div>
                        )}

                        {/* ── Interactive Live ADT Tool Test Bench & Explorer ── */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16,
                            overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                        }}>
                            <div style={{
                                padding: '16px 22px',
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                color: '#ffffff',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 18 }}>🧪</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>Live ADT Tool Test Bench & Inspector</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Test and verify SAP ADT REST services live</div>
                                    </div>
                                </div>
                                <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 12, color: '#cbd5e1' }}>
                                    SAP ADT v1.0
                                </span>
                            </div>

                            <div style={{ padding: '20px 22px' }}>
                                {/* Tool Selector Tabs */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'FETCH_CODE', label: '📄 Fetch ABAP Code', desc: 'Read live class or program source' },
                                        { id: 'RUN_UNIT_TESTS', label: '⚡ Run Unit Tests', desc: 'Execute ABAP Unit tests' },
                                        { id: 'RUN_ATC', label: '🛡️ Run ATC Checks', desc: 'Static code quality analysis' },
                                        { id: 'DESTINATIONS', label: '🌐 System Destinations', desc: 'List configured ADT routes' },
                                    ].map(tool => (
                                        <button
                                            key={tool.id}
                                            type="button"
                                            onClick={() => { setActiveToolTab(tool.id as any); setToolResult(null); setToolError(''); }}
                                            style={{
                                                padding: '8px 14px', borderRadius: 8,
                                                border: activeToolTab === tool.id ? '1.5px solid #FF682C' : '1px solid #e2e8f0',
                                                background: activeToolTab === tool.id ? '#fff5f0' : '#f8fafc',
                                                color: activeToolTab === tool.id ? '#d64a13' : '#475569',
                                                fontSize: 12, fontWeight: activeToolTab === tool.id ? 700 : 500,
                                                cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                        >
                                            {tool.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tool Parameters Input Bar */}
                                {activeToolTab !== 'DESTINATIONS' && (
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                                        {activeToolTab === 'FETCH_CODE' && (
                                            <select
                                                value={testObjectType}
                                                onChange={e => setTestObjectType(e.target.value as any)}
                                                style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#1e293b', fontWeight: 600 }}
                                            >
                                                <option value="CLASS">Class (OO)</option>
                                                <option value="PROGRAM">Program / Report</option>
                                            </select>
                                        )}
                                        <input
                                            type="text"
                                            value={testObjectName}
                                            onChange={e => setTestObjectName(e.target.value.toUpperCase())}
                                            style={{ flex: 1, padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', textTransform: 'uppercase', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#1e293b' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleExecuteAdtTool}
                                            disabled={isExecutingTool || !testObjectName}
                                            style={{
                                                padding: '9px 20px', borderRadius: 6, border: 'none',
                                                background: 'linear-gradient(135deg, #FF682C 0%, #d64a13 100%)',
                                                color: '#fff', fontSize: 13, fontWeight: 700,
                                                cursor: isExecutingTool ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 2px 8px rgba(255,104,44,0.3)',
                                                display: 'flex', alignItems: 'center', gap: 6
                                            }}
                                        >
                                            {isExecutingTool ? '⏳ Executing...' : '🚀 Execute Tool'}
                                        </button>
                                    </div>
                                )}

                                {activeToolTab === 'DESTINATIONS' && (
                                    <div style={{ marginBottom: 16 }}>
                                        <button
                                            type="button"
                                            onClick={handleExecuteAdtTool}
                                            disabled={isExecutingTool}
                                            style={{
                                                padding: '9px 20px', borderRadius: 6, border: 'none',
                                                background: 'linear-gradient(135deg, #FF682C 0%, #d64a13 100%)',
                                                color: '#fff', fontSize: 13, fontWeight: 700,
                                                cursor: isExecutingTool ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 2px 8px rgba(255,104,44,0.3)',
                                                display: 'flex', alignItems: 'center', gap: 6
                                            }}
                                        >
                                            {isExecutingTool ? '⏳ Fetching...' : '🔍 Query Active Destinations'}
                                        </button>
                                    </div>
                                )}

                                {/* Error Output */}
                                {toolError && (
                                    <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12, marginBottom: 12 }}>
                                        <strong>Error:</strong> {toolError}
                                    </div>
                                )}

                                {/* Result Viewer */}
                                {toolResult && (
                                    <div style={{
                                        background: '#0f172a', borderRadius: 10, border: '1px solid #334155',
                                        overflow: 'hidden', display: 'flex', flexDirection: 'column'
                                    }}>
                                        <div style={{
                                            padding: '8px 14px', background: '#1e293b', borderBottom: '1px solid #334155',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                        }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                                                {toolResult.object_name ? `${toolResult.object_type}: ${toolResult.object_name}` : 'OUTPUT RESULT'}
                                            </span>
                                            {toolResult.length && (
                                                <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                                                    {toolResult.length} bytes
                                                </span>
                                            )}
                                        </div>
                                        <pre style={{
                                            margin: 0, padding: 16, maxHeight: 320, overflowY: 'auto',
                                            fontSize: 12, fontFamily: 'Consolas, Monaco, monospace',
                                            color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                                        }}>
                                            {toolResult.code ? toolResult.code : JSON.stringify(toolResult, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>

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
