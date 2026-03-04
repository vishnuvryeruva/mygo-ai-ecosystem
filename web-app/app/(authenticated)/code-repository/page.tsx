'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Editor from '@monaco-editor/react'

interface Source {
    id: string
    name: string
    type: string
    status: string
}

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
}

export default function CodeRepositoryPage() {
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [code, setCode] = useState<string>('// Select a BTP source and click Sync to load data\n')

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your AI Code Assistant.\nLoad some code from a BTP source and tell me how you want to modify it.'
    }])
    const [inputPrompt, setInputPrompt] = useState('')
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchSources()
    }, [])

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const fetchSources = async () => {
        try {
            const res = await axios.get('/api/sources')
            const btpSources = (res.data.sources || []).filter((s: Source) => s.type === 'BTP')
            setSources(btpSources)
            if (btpSources.length > 0) {
                setSelectedSourceId(btpSources[0].id)
            }
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        }
    }

    const handleSync = async () => {
        if (!selectedSourceId) return

        setIsLoading(true)
        try {
            const res = await axios.get(`/api/btp/${selectedSourceId}/fetch-code`)
            setCode(JSON.stringify(res.data.data, null, 2))
        } catch (err: any) {
            console.error('Failed to sync:', err)
            setCode('// Error fetching data:\n// ' + (err.response?.data?.error || err.message))
        } finally {
            setIsLoading(false)
        }
    }

    const handleSendPrompt = async () => {
        if (!inputPrompt.trim() || isGenerating) return

        const userPrompt = inputPrompt.trim()
        setInputPrompt('')

        const newMessages: ChatMessage[] = [
            ...messages,
            { id: Date.now().toString(), role: 'user', content: userPrompt }
        ]
        setMessages(newMessages)
        setIsGenerating(true)

        try {
            const res = await axios.post('/api/btp/generate-code', {
                prompt: userPrompt,
                code: code
            })

            if (res.data.code) {
                setCode(res.data.code)
                setMessages([
                    ...newMessages,
                    { id: Date.now().toString(), role: 'assistant', content: 'I have updated the code according to your instructions. Check the editor!' }
                ])
            } else {
                setMessages([
                    ...newMessages,
                    { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I returned empty code or there was an error.' }
                ])
            }
        } catch (err: any) {
            console.error('Generation failed:', err)
            setMessages([
                ...newMessages,
                { id: Date.now().toString(), role: 'assistant', content: 'Error: ' + (err.response?.data?.error || err.message) }
            ])
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="page-content-area" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="page-main-title" style={{ marginBottom: '0.25rem' }}>Code Repository</h1>
                    <p className="page-main-subtitle" style={{ margin: 0 }}>Browse, analyze, and edit BTP code objects with AI</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>BTP Source:</label>
                    <select
                        value={selectedSourceId}
                        onChange={e => setSelectedSourceId(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', minWidth: '200px', cursor: 'pointer' }}
                    >
                        <option value="" disabled>Select a source...</option>
                        {sources.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={handleSync}
                        disabled={!selectedSourceId || isLoading}
                        style={{ padding: '0.5rem 1.5rem', cursor: (!selectedSourceId || isLoading) ? 'not-allowed' : 'pointer', opacity: (!selectedSourceId || isLoading) ? 0.7 : 1 }}
                    >
                        {isLoading ? 'Syncing...' : 'Sync'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
                {/* Code Editor Pane */}
                <div style={{ flex: 1, background: '#1e1e1e', borderRadius: '0.75rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
                    <div style={{ background: '#2d2d2d', padding: '0.75rem 1.25rem', color: '#e5e7eb', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #404040' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                        Editor
                    </div>
                    <div style={{ flex: 1 }}>
                        <Editor
                            height="100%"
                            defaultLanguage="json"
                            theme="vs-dark"
                            value={code}
                            onChange={(val) => setCode(val || '')}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                                wordWrap: 'on',
                                padding: { top: 16 }
                            }}
                        />
                    </div>
                </div>

                {/* AI Agent Chat Pane */}
                <div style={{ width: '400px', background: 'white', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>

                    {/* Header */}
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.3)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Code Generator Agent</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>AI-powered code editing</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat History */}
                    <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fafafa' }}>
                        {messages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '1rem',
                                    backgroundColor: msg.role === 'user' ? '#0ea5e9' : 'white',
                                    color: msg.role === 'user' ? 'white' : '#334155',
                                    border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.5,
                                    borderBottomRightRadius: msg.role === 'user' ? '0.25rem' : '1rem',
                                    borderBottomLeftRadius: msg.role === 'user' ? '1rem' : '0.25rem',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isGenerating && (
                            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '1rem',
                                    backgroundColor: 'white',
                                    color: '#94a3b8',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.875rem',
                                    borderBottomLeftRadius: '0.25rem',
                                    display: 'flex',
                                    gap: '0.25rem',
                                    alignItems: 'center'
                                }}>
                                    <span className="dot" style={{ animation: 'pulse 1.5s infinite' }}>●</span>
                                    <span className="dot" style={{ animation: 'pulse 1.5s infinite', animationDelay: '0.2s' }}>●</span>
                                    <span className="dot" style={{ animation: 'pulse 1.5s infinite', animationDelay: '0.4s' }}>●</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', background: 'white', borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '9999px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: '0.875rem', transition: 'border-color 0.2s' }}
                                placeholder="Instruct AI to modify code..."
                                value={inputPrompt}
                                onChange={e => setInputPrompt(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendPrompt()}
                                disabled={isGenerating}
                                onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                            />
                            <button
                                onClick={handleSendPrompt}
                                disabled={!inputPrompt.trim() || isGenerating}
                                title="Send Prompt"
                                style={{
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    borderRadius: '50%',
                                    background: inputPrompt.trim() && !isGenerating ? 'linear-gradient(135deg, #0ea5e9, #3b82f6)' : '#e2e8f0',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: inputPrompt.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    transform: inputPrompt.trim() && !isGenerating ? 'scale(1.05)' : 'scale(1)'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px)' }}>
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `}} />
        </div>
    )
}
