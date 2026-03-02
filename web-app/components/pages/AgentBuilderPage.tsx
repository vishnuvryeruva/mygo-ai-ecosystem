'use client'

import { useState } from 'react'

interface Agent {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    color: string
    category: 'knowledge' | 'generation' | 'analysis'
    status: 'active' | 'beta' | 'coming-soon'
}

interface AgentBuilderPageProps {
    onAgentSelect: (agentId: string) => void
}

// ═══════════════════════════════════════════════════════════
//  SVG Icons for Agent Cards
// ═══════════════════════════════════════════════════════════
const agentIcons: Record<string, (color: string) => React.ReactNode> = {
    'ask-yoda': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
    ),
    'solution-advisor': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
        </svg>
    ),
    'spec-assistant': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    'prompt-generator': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    'test-case-generator': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2v6l-2 8h10l-2-8V2" /><path d="M7 16h10" /><path d="M8 2h8" /><circle cx="12" cy="19" r="2" />
        </svg>
    ),
    'explain-code': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" />
        </svg>
    ),
    'code-advisor': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
    ),
    'sync-documents': (c) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
    ),
}

const agents: Agent[] = [
    {
        id: 'ask-yoda',
        name: 'Ask Yoda',
        description: 'AI-powered knowledge assistant for querying your project documentation, specifications, and knowledge base. Ask questions in natural language.',
        icon: agentIcons['ask-yoda']('#034354'),
        color: '#034354',
        category: 'knowledge',
        status: 'active',
    },
    {
        id: 'solution-advisor',
        name: 'Solution Advisor',
        description: 'Conversational solution discovery and refinement. Describe your requirements and get AI-powered solution recommendations with similar solution search.',
        icon: agentIcons['solution-advisor']('#0891b2'),
        color: '#0891b2',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'spec-assistant',
        name: 'Spec Agent',
        description: 'Auto-generate functional and technical specifications from requirements. Supports iterative refinement and export to Word/PDF.',
        icon: agentIcons['spec-assistant']('#7e22ce'),
        color: '#7e22ce',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'prompt-generator',
        name: 'Prompt Generator',
        description: 'Generate optimized prompts for ABAP, CAP, Python, and other languages. Supports conversational refinement of generated prompts.',
        icon: agentIcons['prompt-generator']('#ea580c'),
        color: '#ea580c',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'test-case-generator',
        name: 'Test Case Generator',
        description: 'Generate manual test cases or ABAP unit test skeletons from code. Export results to Word or Excel format.',
        icon: agentIcons['test-case-generator']('#16a34a'),
        color: '#16a34a',
        category: 'generation',
        status: 'active',
    },
    {
        id: 'explain-code',
        name: 'Code Explainer',
        description: 'Paste any ABAP or SAP code and get a detailed, human-readable explanation of what it does, including business logic analysis.',
        icon: agentIcons['explain-code']('#2563eb'),
        color: '#2563eb',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'code-advisor',
        name: 'Code Advisor',
        description: 'Get AI-powered code review, performance suggestions, and best practice recommendations for your ABAP and SAP code.',
        icon: agentIcons['code-advisor']('#059669'),
        color: '#059669',
        category: 'analysis',
        status: 'active',
    },
    {
        id: 'sync-documents',
        name: 'Sync Documents',
        description: 'Synchronize documents from all connected sources including CALM, SharePoint, Jira, and Solman into your knowledge base.',
        icon: agentIcons['sync-documents']('#0891b2'),
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

const categoryIcons: Record<string, React.ReactNode> = {
    knowledge: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
    ),
    generation: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    ),
    analysis: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
    ),
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {cat === 'all' ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                                    </svg>
                                ) : categoryIcons[cat]}
                                {cat === 'all' ? 'All' : categoryLabels[cat]}
                            </span>
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
                                {agent.icon}
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
                            <span className="agent-card-category" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
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
