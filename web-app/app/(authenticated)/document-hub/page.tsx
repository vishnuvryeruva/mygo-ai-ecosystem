'use client'

import DocumentHubPage from '@/components/pages/DocumentHubPage'
import { useRouter } from 'next/navigation'

export default function DocumentHubRoute() {
    const router = useRouter()

    const handleAgentSelect = (agentId: string) => {
        // Dispatch a custom event for the layout to handle agent selection
        window.dispatchEvent(new CustomEvent('agent-select', { detail: { agentId } }))
    }

    return <DocumentHubPage onAgentSelect={handleAgentSelect} />
}
