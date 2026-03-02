'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import TopHeader from '@/components/TopHeader'
import ChatbotWidget from '@/components/ChatbotWidget'
import QuickActionsFAB from '@/components/QuickActionsFAB'
import SolutionAdvisorModal from '@/components/modals/SolutionAdvisorModal'
import SpecAssistantModal from '@/components/modals/SpecAssistantModal'
import PromptGeneratorModal from '@/components/modals/PromptGeneratorModal'
import ExplainCodeModal from '@/components/modals/ExplainCodeModal'
import TestCaseGeneratorModal from '@/components/modals/TestCaseGeneratorModal'
import CodeAdvisorModal from '@/components/modals/CodeAdvisorModal'
import SettingsModal from '@/components/modals/SettingsModal'

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()

    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [chatbotOpen, setChatbotOpen] = useState(false)
    const [chatbotMinimized, setChatbotMinimized] = useState(false)
    const [activeAgent, setActiveAgent] = useState<string | null>('ask-yoda')

    const handleAgentSelect = useCallback((agentId: string) => {
        setActiveAgent(agentId)

        if (agentId === 'ask-yoda') {
            setChatbotOpen(true)
            setChatbotMinimized(false)
        } else if (agentId === 'sync-documents') {
            setActiveAgent('sync-documents')
            setChatbotOpen(true)
            setChatbotMinimized(false)
        } else if (
            [
                'solution-advisor',
                'spec-assistant',
                'prompt-generator',
                'explain-code',
                'test-case-generator',
                'code-advisor',
            ].includes(agentId)
        ) {
            setActiveModal(agentId)
            setChatbotOpen(true)
            setChatbotMinimized(true)
        }
    }, [])

    // Listen for agent-select events from child pages
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.agentId) {
                handleAgentSelect(detail.agentId)
            }
        }
        window.addEventListener('agent-select', handler)
        return () => window.removeEventListener('agent-select', handler)
    }, [handleAgentSelect])

    const handleQuickAction = (actionId: string) => {
        handleAgentSelect(actionId)
        if (actionId === 'document-upload') {
            router.push('/document-hub')
        }
    }

    const closeModal = () => setActiveModal(null)

    return (
        <div className="app-layout">
            <Sidebar />

            <div className="app-main">
                <TopHeader
                    onSettingsClick={() => router.push('/settings')}
                />

                <div className="app-content">
                    {children}
                </div>
            </div>

            {/* Quick Actions FAB */}
            <QuickActionsFAB onAction={handleQuickAction} activeAgent={activeAgent} />

            {/* Modals */}
            {activeModal === 'solution-advisor' && (
                <SolutionAdvisorModal
                    onClose={closeModal}
                    onCreateSpec={(solutionContext) => {
                        setActiveModal('spec-assistant')
                        sessionStorage.setItem('solutionAdvisorContext', solutionContext)
                    }}
                />
            )}
            {activeModal === 'spec-assistant' && <SpecAssistantModal onClose={closeModal} />}
            {activeModal === 'prompt-generator' && <PromptGeneratorModal onClose={closeModal} />}
            {activeModal === 'explain-code' && <ExplainCodeModal onClose={closeModal} />}
            {activeModal === 'test-case-generator' && <TestCaseGeneratorModal onClose={closeModal} />}
            {activeModal === 'code-advisor' && <CodeAdvisorModal onClose={closeModal} />}
            {activeModal === 'settings' && <SettingsModal onClose={closeModal} />}

            {/* Chatbot Widget */}
            <ChatbotWidget
                isOpen={chatbotOpen}
                isMinimized={chatbotMinimized}
                activeAgent={activeAgent}
                onToggleOpen={() => {
                    setChatbotOpen(!chatbotOpen)
                    if (!chatbotOpen) setChatbotMinimized(false)
                }}
                onToggleMinimize={() => setChatbotMinimized(!chatbotMinimized)}
                onClose={() => {
                    setChatbotOpen(false)
                    setChatbotMinimized(false)
                }}
            />
        </div>
    )
}
