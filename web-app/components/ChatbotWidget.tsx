'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

interface Message {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface AgentContext {
    id: string
    name: string
    description: string
    icon: string
    gradient: string
}

const agentContextMap: Record<string, AgentContext> = {
    'ask-yoda': {
        id: 'ask-yoda',
        name: 'Ask Yoda',
        description: 'AI-Powered Knowledge Assistant',
        icon: '🧠',
        gradient: 'linear-gradient(135deg, #034354, #26464C)',
    },
    'solution-advisor': {
        id: 'solution-advisor',
        name: 'Solution Advisor',
        description: 'AI-Powered Solution Recommendations',
        icon: '💡',
        gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
    },
    'spec-assistant': {
        id: 'spec-assistant',
        name: 'Spec Agent',
        description: 'Auto-generate Specifications',
        icon: '📄',
        gradient: 'linear-gradient(135deg, #7e22ce, #a855f7)',
    },
    'prompt-generator': {
        id: 'prompt-generator',
        name: 'Prompt Generator',
        description: 'Generate Workflow Prompts',
        icon: '⚡',
        gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
    },
    'test-case-generator': {
        id: 'test-case-generator',
        name: 'Test Case Generator',
        description: 'Generate Test Cases',
        icon: '🧪',
        gradient: 'linear-gradient(135deg, #16a34a, #22c55e)',
    },
    'explain-code': {
        id: 'explain-code',
        name: 'Explain Code',
        description: 'Intelligent Code Explanations',
        icon: '💻',
        gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    },
    'code-advisor': {
        id: 'code-advisor',
        name: 'Code Advisor',
        description: 'Code Quality Analysis',
        icon: '🛡️',
        gradient: 'linear-gradient(135deg, #059669, #10b981)',
    },
    'sync-documents': {
        id: 'sync-documents',
        name: 'Sync Documents',
        description: 'Sync from All Sources',
        icon: '🔄',
        gradient: 'linear-gradient(135deg, #034354, #0891b2)',
    },
}

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
    onClose
}: ChatbotWidgetProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const agent = activeAgent ? agentContextMap[activeAgent] || agentContextMap['ask-yoda'] : agentContextMap['ask-yoda']

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: input.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            const response = await axios.post('/api/ask-yoda', { query: input.trim() })
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                type: 'assistant',
                content: response.data.answer,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error('Error:', error)
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                type: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen && !isMinimized) return null

    // Minimized state - show Yoda agent icon
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-40">
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

    // Expanded chat state
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
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button onClick={onClose} className="chatbot-header-btn" title="Close">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.length === 0 ? (
                        <div className="chatbot-welcome">
                            <div className="chatbot-welcome-icon">{agent.icon}</div>
                            <h4>Welcome to {agent.name}!</h4>
                            <p>{agent.description}</p>
                            <div className="chatbot-welcome-tip">
                                💡 Tip: Ask me anything about your SAP projects and knowledge base.
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`chatbot-msg ${message.type === 'user' ? 'chatbot-msg-user' : 'chatbot-msg-assistant'}`}
                                >
                                    <div className={`chatbot-msg-bubble ${message.type === 'user' ? 'chatbot-msg-bubble-user' : 'chatbot-msg-bubble-assistant'}`}>
                                        <p>{message.content}</p>
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
                            placeholder={`Ask ${agent.name}...`}
                            className="chatbot-input"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="chatbot-send-btn"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
