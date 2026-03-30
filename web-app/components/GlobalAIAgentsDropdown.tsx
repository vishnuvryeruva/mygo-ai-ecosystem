'use client'

import AIAgentsDropdown from '@/components/AIAgentsDropdown'

export default function GlobalAIAgentsDropdown() {
    const handleAgentSelect = (agentId: string) => {
        window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId } }))
    }

    return <AIAgentsDropdown onAgentSelect={handleAgentSelect} />
}
