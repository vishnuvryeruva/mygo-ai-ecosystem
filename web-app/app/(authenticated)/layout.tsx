'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
    // Multi-chat state: one expanded, many minimized
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
    const [minimizedChats, setMinimizedChats] = useState<string[]>([])
    const [currentUserName, setCurrentUserName] = useState('')

    // Read user name from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem('mygo-user')
            if (raw) {
                const user = JSON.parse(raw)
                setCurrentUserName(user.name || '')
            }
        } catch { /* ignore */ }
    }, [])

    const userInitials = useMemo(() => {
        if (!currentUserName) return ''
        return currentUserName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }, [currentUserName])

    // Agent selection — opens the chatbot with the selected agent
    const handleAgentSelect = useCallback((agentId: string, openModal?: boolean) => {
        if (openModal) {
            // Open the corresponding modal (chatbot stays minimized)
            setActiveModal(agentId)
            // If it's currently expanded, minimize it
            if (expandedAgent === agentId) {
                setExpandedAgent(null)
                setMinimizedChats(prev =>
                    prev.includes(agentId) ? prev : [...prev, agentId]
                )
            }
        } else {
            // If agent is minimized, restore it
            setMinimizedChats(prev => prev.filter(id => id !== agentId))
            setExpandedAgent(agentId)
        }
    }, [expandedAgent])

    // Listen for agent-select events from child pages & chatbot action buttons
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.agentId) {
                handleAgentSelect(detail.agentId, detail.openModal)
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

    // Minimize: move expanded agent to minimized bubbles
    const handleMinimize = useCallback(() => {
        if (expandedAgent) {
            setMinimizedChats(prev =>
                prev.includes(expandedAgent) ? prev : [...prev, expandedAgent]
            )
            setExpandedAgent(null)
        }
    }, [expandedAgent])

    // Close (X) on expanded chat = minimize (same as minimize button)
    const handleClose = useCallback(() => {
        handleMinimize()
    }, [handleMinimize])

    // Restore a minimized bubble to expanded
    const handleRestoreChat = useCallback((agentId: string) => {
        // If there's already an expanded agent, minimize it first
        if (expandedAgent) {
            setMinimizedChats(prev =>
                prev.includes(expandedAgent) ? prev : [...prev, expandedAgent]
            )
        }
        setMinimizedChats(prev => prev.filter(id => id !== agentId))
        setExpandedAgent(agentId)
    }, [expandedAgent])

    // Fully close a minimized bubble (remove entirely)
    const handleDismissBubble = useCallback((agentId: string) => {
        setMinimizedChats(prev => prev.filter(id => id !== agentId))
    }, [])

    return (
        <div className="app-layout">
            <Sidebar />

            <div className="app-main">
                <TopHeader
                    onSettingsClick={() => router.push('/settings')}
                    userName={userInitials}
                />

                <div className="app-content">
                    {children}
                </div>
            </div>

            {/* Quick Actions FAB */}
            <QuickActionsFAB onAction={handleQuickAction} activeAgent={expandedAgent} />

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
                expandedAgent={expandedAgent}
                minimizedChats={minimizedChats}
                onMinimize={handleMinimize}
                onClose={handleClose}
                onRestoreChat={handleRestoreChat}
                onDismissBubble={handleDismissBubble}
            />
        </div>
    )
}

