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
import SyncSourceModal from '@/components/modals/SyncSourceModal'
import FileUploadModal from '@/components/modals/FileUploadModal'
import CapPromptGeneratorModal from '@/components/modals/CapPromptGeneratorModal'

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
    // Code Advisor modal initial data
    const [codeAdvisorData, setCodeAdvisorData] = useState<{ code: string; codeType: string } | null>(null)
    // Sync Source modal state
    const [syncSourceModalOpen, setSyncSourceModalOpen] = useState(false)
    const [preSelectedSourceId, setPreSelectedSourceId] = useState<string | null>(null)
    // Prompt Studio modal initial data
    const [promptStudioData, setPromptStudioData] = useState<{ 
        prompt: string; 
        language: string; 
        task?: string;
        autoGenerate?: boolean;
    } | null>(null)

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

    // Agent initial data for pre-filling modals
    const [agentInitialData, setAgentInitialData] = useState<any>(null)
    
    // Agent selection — opens the chatbot with the selected agent
    const handleAgentSelect = useCallback((agentId: string, openModal?: boolean, initialData?: any) => {
        if (initialData) {
            setAgentInitialData(initialData)
        }

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
            // If the event was already handled by a local page (like Code Hub), ignore it
            if (detail?.handled) return
            
            if (detail?.agentId) {
                handleAgentSelect(detail.agentId, detail.openModal, detail.initialData)
            }
        }
        window.addEventListener('agent-select', handler)
        return () => window.removeEventListener('agent-select', handler)
    }, [handleAgentSelect])

    // Listen for agent-data-open events (specifically for opening agents with pre-fetched data)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.agentId && detail?.data) {
                handleAgentSelect(detail.agentId, true, detail.data)
            }
        }
        window.addEventListener('agent-data-open', handler)
        return () => window.removeEventListener('agent-data-open', handler)
    }, [handleAgentSelect])

    const handleQuickAction = (actionId: string) => {
        // Ask Yoda opens the chatbot widget
        if (actionId === 'ask-yoda') {
            handleAgentSelect(actionId)
            return
        }
        // All other actions open their modal directly
        if (actionId === 'sync-sources') {
            setSyncSourceModalOpen(true)
            return
        }
        setActiveModal(actionId)
    }

    const closeModal = () => {
        setActiveModal(null)
        setCodeAdvisorData(null)
        setPromptStudioData(null)
        setAgentInitialData(null)
    }

    const closeSyncSourceModal = () => {
        setSyncSourceModalOpen(false)
        setPreSelectedSourceId(null)
    }

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
                        sessionStorage.setItem('specAssistantAutoGenerate', '1')
                    }}
                />
            )}
            {activeModal === 'spec-assistant' && <SpecAssistantModal onClose={closeModal} initialData={agentInitialData} />}
            {activeModal === 'prompt-generator' && (
                <PromptGeneratorModal 
                    onClose={closeModal} 
                    initialPrompt={promptStudioData?.prompt || agentInitialData?.code || agentInitialData?.prompt}
                    initialLanguage={promptStudioData?.language || agentInitialData?.language || 'ABAP'}
                    initialTask={promptStudioData?.task || agentInitialData?.task}
                    autoGenerateCode={promptStudioData?.autoGenerate || agentInitialData?.autoGenerate}
                />
            )}
            {activeModal === 'explain-code' && <ExplainCodeModal onClose={closeModal} initialData={agentInitialData} />}
            {activeModal === 'test-case-generator' && <TestCaseGeneratorModal onClose={closeModal} initialData={agentInitialData} />}
            {activeModal === 'document-upload' && <FileUploadModal onClose={closeModal} />}
            {activeModal === 'code-advisor' && (
                <CodeAdvisorModal 
                    onClose={closeModal} 
                    initialCode={codeAdvisorData?.code || agentInitialData?.code}
                    initialCodeType={codeAdvisorData?.codeType || agentInitialData?.language || 'ABAP'}
                />
            )}
            {activeModal === 'settings' && <SettingsModal onClose={closeModal} />}
            {activeModal === 'cap-generator' && (
                <CapPromptGeneratorModal 
                    isOpen={activeModal === 'cap-generator'} 
                    onClose={closeModal} 
                />
            )}

            {/* Sync Source Modal */}
            {syncSourceModalOpen && (
                <SyncSourceModal 
                    isOpen={syncSourceModalOpen}
                    onClose={closeSyncSourceModal}
                    preSelectedSourceId={preSelectedSourceId}
                />
            )}

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

