'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import RichTextResponse from '@/components/RichTextResponse'

// ═══════════════════════════════════════════════════════════
//  SVG Icon Components (replacing emoji)
// ═══════════════════════════════════════════════════════════
const YodaIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
)
const SolutionIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    </svg>
)
const SpecIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
)
const PromptIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)
const TestIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2v6l-2 8h10l-2-8V2" /><path d="M7 16h10" /><path d="M8 2h8" /><circle cx="12" cy="19" r="2" />
    </svg>
)
const ExplainIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" />
    </svg>
)
const CodeAdvisorIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
)
const SyncIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
)

// ═══════════════════════════════════════════════════════════
//  Message Types
// ═══════════════════════════════════════════════════════════
interface ChatAction {
    id: string
    label: string
    variant?: 'primary' | 'secondary' | 'outline'
    icon?: string
}

interface ChatMessage {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
    // Rich message support
    actions?: ChatAction[]
    isRichText?: boolean
    status?: 'info' | 'success' | 'error' | 'loading'
}

// ═══════════════════════════════════════════════════════════
//  Agent Configuration
// ═══════════════════════════════════════════════════════════
interface AgentConfig {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    gradient: string
    welcomeMessage: string
    welcomeActions?: ChatAction[]
    placeholder: string
}

const agentConfigs: Record<string, AgentConfig> = {
    'ask-yoda': {
        id: 'ask-yoda',
        name: 'Ask Yoda',
        description: 'AI-Powered Knowledge Assistant',
        icon: <YodaIcon />,
        gradient: 'linear-gradient(135deg, #034354, #26464C)',
        welcomeMessage: 'I\'m Yoda, your AI knowledge assistant. Ask me anything about your SAP projects, documents, and knowledge base.',
        welcomeActions: [
            { id: 'example-1', label: 'What documents do we have?', variant: 'outline' },
            { id: 'example-2', label: 'Summarize project status', variant: 'outline' },
            { id: 'example-3', label: 'Find technical specs', variant: 'outline' },
        ],
        placeholder: 'Ask Yoda anything...',
    },
    'solution-advisor': {
        id: 'solution-advisor',
        name: 'Solution Advisor',
        description: 'AI-Powered Solution Design',
        icon: <SolutionIcon />,
        gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
        welcomeMessage: 'I\'ll help you design SAP solutions. Describe your requirements and I\'ll provide recommendations.',
        welcomeActions: [
            { id: 'open-modal', label: 'Open Full Advisor', variant: 'primary' },
            { id: 'quick-advice', label: 'Quick Question', variant: 'outline' },
        ],
        placeholder: 'Describe your requirements...',
    },
    'spec-assistant': {
        id: 'spec-assistant',
        name: 'Spec Agent',
        description: 'Auto-generate Specifications',
        icon: <SpecIcon />,
        gradient: 'linear-gradient(135deg, #7e22ce, #a855f7)',
        welcomeMessage: 'I can generate functional and technical specifications. How would you like to proceed?',
        welcomeActions: [
            { id: 'open-modal', label: 'Generate New Spec', variant: 'primary' },
            { id: 'gen-from-desc', label: 'Quick Spec from Description', variant: 'outline' },
        ],
        placeholder: 'Describe what you need a spec for...',
    },
    'prompt-generator': {
        id: 'prompt-generator',
        name: 'Prompt Generator',
        description: 'Generate Workflow Prompts',
        icon: <PromptIcon />,
        gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
        welcomeMessage: 'I generate optimized prompts for ABAP, CAP, Python, and more. What would you like?',
        welcomeActions: [
            { id: 'open-modal', label: 'Open Prompt Studio', variant: 'primary' },
            { id: 'quick-prompt', label: 'Quick Prompt', variant: 'outline' },
        ],
        placeholder: 'Describe the prompt you need...',
    },
    'test-case-generator': {
        id: 'test-case-generator',
        name: 'Test Case Generator',
        description: 'Generate Test Cases',
        icon: <TestIcon />,
        gradient: 'linear-gradient(135deg, #16a34a, #22c55e)',
        welcomeMessage: 'I can generate manual test cases or ABAP unit test skeletons. Choose an option to start.',
        welcomeActions: [
            { id: 'open-modal', label: 'Open Test Generator', variant: 'primary' },
            { id: 'quick-test', label: 'Quick Test from Description', variant: 'outline' },
        ],
        placeholder: 'Describe the scenario to test...',
    },
    'explain-code': {
        id: 'explain-code',
        name: 'Code Explainer',
        description: 'Intelligent Code Analysis',
        icon: <ExplainIcon />,
        gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        welcomeMessage: 'Paste any ABAP or SAP code and I\'ll explain what it does in plain language.',
        welcomeActions: [
            { id: 'open-modal', label: 'Open Code Explainer', variant: 'primary' },
            { id: 'paste-code', label: 'Paste Code Here', variant: 'outline' },
        ],
        placeholder: 'Paste code or describe what to explain...',
    },
    'code-advisor': {
        id: 'code-advisor',
        name: 'Code Advisor',
        description: 'Code Quality Analysis',
        icon: <CodeAdvisorIcon />,
        gradient: 'linear-gradient(135deg, #059669, #10b981)',
        welcomeMessage: 'I\'ll review your code for quality, performance, and best practices.',
        welcomeActions: [
            { id: 'open-modal', label: 'Open Code Review', variant: 'primary' },
            { id: 'paste-code', label: 'Paste Code Here', variant: 'outline' },
        ],
        placeholder: 'Paste code for review...',
    },
    'sync-documents': {
        id: 'sync-documents',
        name: 'Sync Documents',
        description: 'Sync from Sources',
        icon: <SyncIcon />,
        gradient: 'linear-gradient(135deg, #034354, #0891b2)',
        welcomeMessage: 'I can help you sync documents from your connected sources. Choose a source to get started.',
        welcomeActions: [
            { id: 'sync-calm', label: 'Sync from CALM', variant: 'primary' },
            { id: 'sync-all', label: 'Sync All Sources', variant: 'outline' },
            { id: 'check-sources', label: 'View Connected Sources', variant: 'outline' },
        ],
        placeholder: 'Ask about syncing...',
    },
}

// ═══════════════════════════════════════════════════════════
//  Agent-Specific Handlers
// ═══════════════════════════════════════════════════════════
async function handleAgentMessage(agentId: string, query: string): Promise<{
    content: string
    actions?: ChatAction[]
    isRichText?: boolean
}> {
    switch (agentId) {
        case 'ask-yoda': {
            const res = await axios.post('/api/ask-yoda', { query })
            return { content: res.data.answer, isRichText: true }
        }
        case 'solution-advisor': {
            const res = await axios.post('/api/solution-advisor/requirements', { user_input: query })
            return {
                content: res.data.analysis || res.data.error || 'Here is my analysis of your requirements.',
                isRichText: true,
                actions: [
                    { id: 'open-modal', label: 'Open Full Advisor for More Detail', variant: 'secondary' },
                ],
            }
        }
        case 'spec-assistant': {
            const res = await axios.post('/api/spec-assistant', {
                title: 'Quick Spec',
                description: query,
                specType: 'functional',
            })
            return {
                content: res.data.spec || res.data.error || 'I\'ve generated a spec based on your description.',
                isRichText: true,
                actions: [
                    { id: 'open-modal', label: 'Open Spec Editor for Full Controls', variant: 'secondary' },
                ],
            }
        }
        case 'prompt-generator': {
            const res = await axios.post('/api/prompt-generator', { description: query })
            return {
                content: res.data.prompt || res.data.error || 'Here is your generated prompt.',
                isRichText: true,
            }
        }
        case 'test-case-generator': {
            const res = await axios.post('/api/test-case-generator', {
                code: query,
                language: 'ABAP',
                format: 'manual',
            })
            return {
                content: res.data.test_cases || res.data.error || 'Here are the generated test cases.',
                isRichText: true,
                actions: [
                    { id: 'open-modal', label: 'Open Full Test Generator', variant: 'secondary' },
                ],
            }
        }
        case 'explain-code': {
            const res = await axios.post('/api/explain-code', {
                code: query,
                language: 'ABAP',
            })
            return {
                content: res.data.explanation || res.data.error || 'Here is the code explanation.',
                isRichText: true,
            }
        }
        case 'code-advisor': {
            const res = await axios.post('/api/code-advisor', { code: query })
            return {
                content: res.data.analysis || res.data.error || 'Here is my code review.',
                isRichText: true,
            }
        }
        case 'sync-documents': {
            // For sync, use Ask Yoda for conversational queries about syncing
            const res = await axios.post('/api/ask-yoda', { query: `Regarding document sync: ${query}` })
            return {
                content: res.data.answer,
                isRichText: true,
                actions: [
                    { id: 'sync-calm', label: 'Sync from CALM', variant: 'primary' },
                ],
            }
        }
        default: {
            const res = await axios.post('/api/ask-yoda', { query })
            return { content: res.data.answer, isRichText: true }
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  Action Button Component
// ═══════════════════════════════════════════════════════════
function ActionButton({ action, onClick }: { action: ChatAction; onClick: () => void }) {
    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        fontSize: '0.78rem',
        fontWeight: 600,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: '1px solid transparent',
        whiteSpace: 'nowrap',
    }

    const variants: Record<string, React.CSSProperties> = {
        primary: { ...baseStyle, background: '#034354', color: 'white', border: '1px solid #034354' },
        secondary: { ...baseStyle, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' },
        outline: { ...baseStyle, background: 'transparent', color: '#334155', border: '1px solid #cbd5e1' },
    }

    return (
        <button style={variants[action.variant || 'outline']} onClick={onClick}>
            {action.label}
        </button>
    )
}

// ═══════════════════════════════════════════════════════════
//  Status Indicator
// ═══════════════════════════════════════════════════════════
function StatusBubble({ status, content }: { status: string; content: string }) {
    const colors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
        info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#3b82f6' },
        success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', dot: '#22c55e' },
        error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#ef4444' },
        loading: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b' },
    }
    const c = colors[status] || colors.info

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '8px',
            background: c.bg, border: `1px solid ${c.border}`,
            fontSize: '0.8rem', color: c.text, fontWeight: 500,
        }}>
            <div style={{
                width: '7px', height: '7px', borderRadius: '50%', background: c.dot,
                flexShrink: 0, animation: status === 'loading' ? 'pulse 1.5s infinite' : 'none',
            }} />
            {content}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════
//  Main ChatbotWidget Component
// ═══════════════════════════════════════════════════════════
interface ChatbotWidgetProps {
    isOpen: boolean
    isMinimized: boolean
    activeAgent?: string | null
    onToggleOpen: () => void
    onToggleMinimize: () => void
    onClose: () => void
}

export default function ChatbotWidget({
    isOpen,
    isMinimized,
    activeAgent,
    onToggleOpen,
    onToggleMinimize,
    onClose,
}: ChatbotWidgetProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [prevAgent, setPrevAgent] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const agentId = activeAgent || 'ask-yoda'
    const agent = agentConfigs[agentId] || agentConfigs['ask-yoda']

    // Clear messages when agent changes
    useEffect(() => {
        if (activeAgent && activeAgent !== prevAgent) {
            setMessages([])
            setPrevAgent(activeAgent)
        }
    }, [activeAgent, prevAgent])

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    // ── Handle action button clicks ──────────────
    const handleAction = async (action: ChatAction) => {
        if (action.id === 'open-modal') {
            // Dispatch event to open the corresponding modal
            window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId, openModal: true } }))
            // Add status message
            addAssistantMessage({
                content: `Opening ${agent.name}... The full editor will appear. I'll be here when you're done!`,
                status: 'info',
            })
            return
        }

        if (action.id === 'sync-calm') {
            await handleSyncFromCalm()
            return
        }

        if (action.id === 'sync-all') {
            addAssistantMessage({ content: 'Checking all connected sources...', status: 'loading' })
            try {
                const res = await axios.get('/api/sources')
                const sources = res.data.sources || []
                if (sources.length === 0) {
                    addAssistantMessage({ content: 'No sources configured. Go to Settings → Sources to add one.', status: 'error' })
                } else {
                    const sourceNames = sources.map((s: any) => s.name).join(', ')
                    addAssistantMessage({
                        content: `Found ${sources.length} configured source(s): ${sourceNames}. Which one would you like to sync from?`,
                        actions: sources.map((s: any) => ({
                            id: `sync-source-${s.id}`,
                            label: `Sync ${s.name}`,
                            variant: 'primary' as const,
                        })),
                    })
                }
            } catch {
                addAssistantMessage({ content: 'Could not fetch sources. Make sure the backend is running.', status: 'error' })
            }
            return
        }

        if (action.id === 'check-sources') {
            try {
                const res = await axios.get('/api/sources')
                const sources = res.data.sources || []
                if (sources.length === 0) {
                    addAssistantMessage({ content: 'No sources are configured yet. Go to Settings → Sources to add your first source.', status: 'info' })
                } else {
                    const list = sources.map((s: any) => `• **${s.name}** (${s.type}) — ${s.status || 'configured'}`).join('\n')
                    addAssistantMessage({
                        content: `**Connected Sources (${sources.length}):**\n\n${list}`,
                        isRichText: true,
                    })
                }
            } catch {
                addAssistantMessage({ content: 'Could not fetch sources. Make sure the backend is running.', status: 'error' })
            }
            return
        }

        // Example/quick actions — treat as a user query
        if (action.id.startsWith('example-') || action.id.startsWith('quick-') || action.id === 'paste-code' || action.id === 'gen-from-desc') {
            setInput(action.label)
            return
        }
    }

    // ── Sync from CALM handler ───────────────────
    const handleSyncFromCalm = async () => {
        addAssistantMessage({ content: 'Checking for CALM source configuration...', status: 'loading' })
        try {
            const res = await axios.get('/api/sources')
            const sources = res.data.sources || []
            const calmSource = sources.find((s: any) =>
                s.name?.toLowerCase().includes('calm') || s.type?.toLowerCase().includes('calm')
            )
            if (!calmSource) {
                addAssistantMessage({
                    content: 'No CALM source found in your configuration. Would you like to set one up in Settings?',
                    status: 'error',
                    actions: [{ id: 'go-settings', label: 'Open Settings', variant: 'primary' }],
                })
                return
            }

            addAssistantMessage({ content: `Found CALM source: **${calmSource.name}**. Fetching available projects...`, status: 'info', isRichText: true })

            // Fetch projects
            const projRes = await axios.get(`/api/calm/projects?source_id=${calmSource.id}`)
            const projects = projRes.data.projects || []
            if (projects.length === 0) {
                addAssistantMessage({ content: 'No projects found in this CALM instance.', status: 'info' })
            } else {
                addAssistantMessage({
                    content: `Found **${projects.length} projects**. Select one to browse documents:`,
                    isRichText: true,
                    actions: projects.slice(0, 8).map((p: any) => ({
                        id: `calm-project-${p.id}`,
                        label: p.name,
                        variant: 'outline' as const,
                    })),
                })
            }
        } catch {
            addAssistantMessage({
                content: 'Could not connect to CALM. Check your source configuration in Settings.',
                status: 'error',
            })
        }
    }

    // ── Helper to add assistant messages ──────────
    const addAssistantMessage = (msg: Partial<ChatMessage>) => {
        setMessages(prev => [...prev, {
            id: `assistant-${Date.now()}-${Math.random()}`,
            type: 'assistant',
            content: msg.content || '',
            timestamp: new Date(),
            actions: msg.actions,
            isRichText: msg.isRichText,
            status: msg.status,
        }])
    }

    // ── Submit handler ───────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)

        try {
            const result = await handleAgentMessage(agentId, userMsg.content)
            addAssistantMessage(result)
        } catch (error) {
            console.error('Error:', error)
            addAssistantMessage({ content: 'Sorry, I encountered an error. Please try again.', status: 'error' })
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen && !isMinimized) return null

    // ── Minimized state ──────────────────────────
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6" style={{ zIndex: 100 }}>
                <button
                    onClick={onToggleMinimize}
                    className="yoda-mini-btn"
                    title={agent.name}
                    style={{ background: agent.gradient }}
                >
                    <div className="yoda-mini-icon">{agent.icon}</div>
                    <div className="yoda-mini-pulse" />
                    {messages.length > 0 && (
                        <div className="yoda-mini-badge">
                            {messages.filter(m => m.type === 'assistant').length}
                        </div>
                    )}
                </button>
            </div>
        )
    }

    // ── Expanded chat ────────────────────────────
    return (
        <div className="chatbot-container">
            <div className="chatbot-panel">
                {/* Header */}
                <div className="chatbot-header" style={{ background: agent.gradient }}>
                    <div className="chatbot-header-info">
                        <div className="chatbot-header-icon">{agent.icon}</div>
                        <div>
                            <h3 className="chatbot-header-title">{agent.name}</h3>
                            <p className="chatbot-header-desc">{agent.description}</p>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button onClick={onToggleMinimize} className="chatbot-header-btn" title="Minimize">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button onClick={onClose} className="chatbot-header-btn" title="Close">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.length === 0 ? (
                        <div className="chatbot-welcome">
                            <div className="chatbot-welcome-icon" style={{ color: '#034354' }}>{agent.icon}</div>
                            <h4>Welcome to {agent.name}!</h4>
                            <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                                {agent.welcomeMessage}
                            </p>
                            {agent.welcomeActions && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                    {agent.welcomeActions.map(action => (
                                        <ActionButton key={action.id} action={action} onClick={() => handleAction(action)} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`chatbot-msg ${message.type === 'user' ? 'chatbot-msg-user' : 'chatbot-msg-assistant'}`}
                                >
                                    <div className={`chatbot-msg-bubble ${message.type === 'user' ? 'chatbot-msg-bubble-user' : 'chatbot-msg-bubble-assistant'}`}>
                                        {/* Status indicator */}
                                        {message.status && (
                                            <StatusBubble status={message.status} content={message.content} />
                                        )}

                                        {/* Text content */}
                                        {!message.status && (
                                            message.isRichText ? (
                                                <RichTextResponse content={message.content} />
                                            ) : (
                                                <p>{message.content}</p>
                                            )
                                        )}

                                        {/* Action buttons */}
                                        {message.actions && message.actions.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                                                {message.actions.map(action => (
                                                    <ActionButton key={action.id} action={action} onClick={() => handleAction(action)} />
                                                ))}
                                            </div>
                                        )}

                                        <span className="chatbot-msg-time">
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="chatbot-msg chatbot-msg-assistant">
                                    <div className="chatbot-msg-bubble chatbot-msg-bubble-assistant">
                                        <div className="chatbot-typing">
                                            <div className="chatbot-typing-dot" style={{ animationDelay: '0ms' }} />
                                            <div className="chatbot-typing-dot" style={{ animationDelay: '150ms' }} />
                                            <div className="chatbot-typing-dot" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="chatbot-input-area">
                    <form onSubmit={handleSubmit} className="chatbot-input-form">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSubmit(e)
                                }
                            }}
                            placeholder={agent.placeholder}
                            className="chatbot-input"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="chatbot-send-btn"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
