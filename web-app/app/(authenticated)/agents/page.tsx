'use client'

import AgentBuilderPage from '@/components/pages/AgentBuilderPage'

export default function AgentsRoute() {
    const handleAgentSelect = (agentId: string) => {
        window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId } }))
    }

    return <AgentBuilderPage onAgentSelect={handleAgentSelect} />
}
