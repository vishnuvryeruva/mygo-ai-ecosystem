'use client'

import AgentBuilderPage from '@/components/pages/AgentBuilderPage'

export default function AgentsRoute() {
    const handleAgentSelect = (agentId: string) => {
        const openModal = agentId !== 'ask-yoda' && agentId !== 'matrix'
        window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId, openModal } }))
    }

    return <AgentBuilderPage onAgentSelect={handleAgentSelect} />
}
