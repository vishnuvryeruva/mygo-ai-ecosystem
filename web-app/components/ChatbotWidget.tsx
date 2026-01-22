'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

interface Message {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface ChatbotWidgetProps {
    isOpen: boolean
    isMinimized: boolean
    onToggleOpen: () => void
    onToggleMinimize: () => void
    onClose: () => void
}

export default function ChatbotWidget({
    isOpen,
    isMinimized,
    onToggleOpen,
    onToggleMinimize,
    onClose
}: ChatbotWidgetProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

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
            console.error('Error asking Yoda:', error)
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

    // Don't render anything if completely closed
    if (!isOpen && !isMinimized) return null

    // Minimized bubble state
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    onClick={onToggleMinimize}
                    className="group relative bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                    title="Open Ask Yoda"
                    style={{ boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)' }}
                >
                    <div className="text-3xl">🧠</div>
                    {messages.length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {messages.filter(m => m.type === 'assistant').length}
                        </div>
                    )}
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                        Ask Yoda
                    </div>
                </button>
            </div>
        )
    }

    // Expanded chat state
    return (
        <div className="fixed bottom-6 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] animate-slideInUp">
            <div className="glass rounded-2xl shadow-2xl overflow-hidden border border-white/10" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(99, 102, 241, 0.2)' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="text-2xl">🧠</div>
                        <div>
                            <h3 className="text-white font-semibold text-lg">Ask Yoda</h3>
                            <p className="text-indigo-100 text-xs">AI-Powered Knowledge Assistant</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onToggleMinimize}
                            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                            title="Minimize"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                            title="Close"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="h-96 overflow-y-auto p-4 space-y-4" style={{ background: 'rgba(10, 10, 15, 0.95)' }}>
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="text-6xl mb-4">🧠</div>
                            <h4 className="text-white font-semibold mb-2">Welcome to Ask Yoda!</h4>
                            <p className="text-gray-400 text-sm">
                                Query historical blueprints, specs, tickets, and test cases. Ask me anything!
                            </p>
                            <div className="mt-4 glass-subtle p-3 text-xs text-indigo-300">
                                💡 Tip: Upload documents via the <strong>Document Upload</strong> tile to expand my knowledge base.
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${message.type === 'user'
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                                            : 'glass-subtle text-gray-200'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                        <p
                                            className={`text-xs mt-1 ${message.type === 'user' ? 'text-indigo-100' : 'text-gray-500'
                                                }`}
                                        >
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="glass-subtle rounded-2xl px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10" style={{ background: 'rgba(18, 18, 26, 0.95)' }}>
                    <form onSubmit={handleSubmit} className="flex items-end space-x-2">
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
                            placeholder="Ask a question..."
                            className="input flex-1"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="btn btn-primary px-4"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>

            {/* Custom animations */}
            <style jsx>{`
        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slideInUp {
          animation: slideInUp 0.3s ease-out;
        }
      `}</style>
        </div>
    )
}
