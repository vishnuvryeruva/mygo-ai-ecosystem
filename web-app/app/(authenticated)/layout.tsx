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

    // Listen for code-advisor-open events with initial data
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.code !== undefined && detail?.codeType !== undefined) {
                setCodeAdvisorData({ code: detail.code, codeType: detail.codeType })
                setActiveModal('code-advisor')
            }
        }
        window.addEventListener('code-advisor-open', handler)
        return () => window.removeEventListener('code-advisor-open', handler)
    }, [])

    // Listen for sync-source-open events with pre-selected source
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.sourceId !== undefined) {
                setPreSelectedSourceId(detail.sourceId)
                setSyncSourceModalOpen(true)
            }
        }
        window.addEventListener('sync-source-open', handler)
        return () => window.removeEventListener('sync-source-open', handler)
    }, [])

    // Listen for prompt-studio-open events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.prompt !== undefined) {
                setPromptStudioData({ 
                    prompt: detail.prompt, 
                    language: detail.language || 'ABAP',
                    task: detail.task,
                    autoGenerate: detail.autoGenerate
                })
                setActiveModal('prompt-generator')
            }
        }
        window.addEventListener('prompt-studio-open', handler)
        return () => window.removeEventListener('prompt-studio-open', handler)
    }, [])

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
            {activeModal === 'spec-assistant' && <SpecAssistantModal onClose={closeModal} />}
            {activeModal === 'prompt-generator' && (
                <PromptGeneratorModal 
                    onClose={closeModal} 
                    initialPrompt={promptStudioData?.prompt}
                    initialLanguage={promptStudioData?.language}
                    initialTask={promptStudioData?.task}
                    autoGenerateCode={promptStudioData?.autoGenerate}
                />
            )}
            {activeModal === 'explain-code' && <ExplainCodeModal onClose={closeModal} />}
            {activeModal === 'test-case-generator' && <TestCaseGeneratorModal onClose={closeModal} />}
            {activeModal === 'document-upload' && <FileUploadModal onClose={closeModal} />}
            {activeModal === 'code-advisor' && (
                <CodeAdvisorModal 
                    onClose={closeModal} 
                    initialCode={codeAdvisorData?.code}
                    initialCodeType={codeAdvisorData?.codeType}
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

