'use client'

import { useState } from 'react'

interface Agent {
    id: string
    name: string
    description: string
    icon: string
    color: string
    category: 'knowledge' | 'generation' | 'analysis'
    status: 'active' | 'beta' | 'coming-soon'
}

interface AgentBuilderPageProps {
    onAgentSelect: (agentId: string) => void
}

const agents: Agent[] = [
    {
        id: 'ask-yoda',
        name: 'Ask Yoda',
        description: 'AI-powered knowledge assistant for querying your project documentation, specifications, and knowledge base. Ask questions in natural language.',
        icon: '🧠',
        color: '#034354',
        category: 'knowledge',
        status: 'active',
    },
    {
        id: 'solution-advisor',
        name: 'Solution Advisor',
        description: 'Conversational solution discovery and refinement. Describe your requirements and get AI-powered solution recommendations with similar solution search.',
        icon: '💡',
        color: '#0891b2',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'spec-assistant',
        name: 'Spec Agent',
        description: 'Auto-generate functional and technical specifications from requirements. Supports iterative refinement and export to Word/PDF.',
        icon: '📄',
        color: '#7e22ce',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'prompt-generator',
        name: 'Prompt Generator',
        description: 'Generate optimized prompts for ABAP, CAP, Python, and other languages. Supports conversational refinement of generated prompts.',
        icon: '⚡',
        color: '#ea580c',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'test-case-generator',
        name: 'Test Case Generator',
        description: 'Generate manual test cases or ABAP unit test skeletons from code. Export results to Word or Excel format.',
        icon: '🧪',
        color: '#16a34a',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'explain-code',
        name: 'Code Explainer',
        description: 'Paste any ABAP or SAP code and get a detailed, human-readable explanation of what it does, including business logic analysis.',
        icon: '🔍',
        color: '#2563eb',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'code-advisor',
        name: 'Code Advisor',
        description: 'Get AI-powered code review, performance suggestions, and best practice recommendations for your ABAP and SAP code.',
        icon: '🛡️',
        color: '#dc2626',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'sync-documents',
        name: 'Sync Documents',
        description: 'Synchronize documents from all connected sources including CALM, SharePoint, Jira, and Solman into your knowledge base.',
        icon: '🔄',
        color: '#0891b2',
        category: 'knowledge',
        status: 'active',
    },
]

const categoryLabels: Record<string, string> = {
    knowledge: 'Knowledge & Data',
    generation: 'Content Generation',
    analysis: 'Code Analysis',
}

const categoryIcons: Record<string, string> = {
    knowledge: '📚',
    generation: '✨',
    analysis: '🔬',
}

export default function AgentBuilderPage({ onAgentSelect }: AgentBuilderPageProps) {
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    const categories = ['all', 'knowledge', 'generation', 'analysis']

    const filteredAgents = agents.filter(agent => {
        const matchesCategory = activeCategory === 'all' || agent.category === activeCategory
        const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.description.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    return (
        <div className="page-content-area">
            {/* Header */}
            <div className="agent-builder-header">
                <div>
                    <h1 className="page-main-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                        </svg>
                        Agent Builder
                    </h1>
                    <p className="page-main-subtitle">Configure and launch AI agents for your SAP workflows</p>
                </div>
            </div>

            {/* Search + Filter Bar */}
            <div className="agent-builder-controls">
                <div className="agent-builder-search">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search agents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="agent-builder-search-input"
                    />
                </div>

                <div className="agent-builder-tabs">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`agent-builder-tab ${activeCategory === cat ? 'agent-builder-tab-active' : ''}`}
                        >
                            {cat === 'all' ? '🏠 All' : `${categoryIcons[cat]} ${categoryLabels[cat]}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Agent Count */}
            <p className="agent-builder-count">
                <span style={{ color: 'var(--mygo-orange)', fontWeight: 700 }}>{filteredAgents.length}</span> agents available
            </p>

            {/* Agent Cards Grid */}
            <div className="agent-builder-grid">
                {filteredAgents.map(agent => (
                    <div key={agent.id} className="agent-card">
                        <div className="agent-card-header">
                            <div
                                className="agent-card-icon"
                                style={{ background: `${agent.color}14`, color: agent.color }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{agent.icon}</span>
                            </div>
                            <div className="agent-card-info">
                                <h3 className="agent-card-name">{agent.name}</h3>
                                <span className={`agent-card-status agent-card-status-${agent.status}`}>
                                    {agent.status === 'active' ? '● Active' : agent.status === 'beta' ? '◐ Beta' : '○ Coming Soon'}
                                </span>
                            </div>
                        </div>

                        <p className="agent-card-desc">{agent.description}</p>

                        <div className="agent-card-footer">
                            <span className="agent-card-category">
                                {categoryIcons[agent.category]} {categoryLabels[agent.category]}
                            </span>
                            <button
                                onClick={() => onAgentSelect(agent.id)}
                                className="agent-card-launch"
                                style={{ background: agent.color }}
                                disabled={agent.status === 'coming-soon'}
                            >
                                Launch
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
