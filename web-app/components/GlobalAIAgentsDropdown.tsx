'use client'

import AIAgentsDropdown from '@/components/AIAgentsDropdown'

export default function GlobalAIAgentsDropdown() {
    const handleAgentSelect = (agentId: string) => {
        if (agentId === 'sync-sources') {
            window.dispatchEvent(new CustomEvent('sync-source-open', { detail: { sourceId: null } }))
            return
        }
        const openModal = agentId !== 'ask-yoda' && agentId !== 'matrix'
        window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId, openModal } }))
    }

    return <AIAgentsDropdown onAgentSelect={handleAgentSelect} />
}
