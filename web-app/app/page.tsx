'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import DashboardLayout from '@/components/DashboardLayout'
import FeatureCard from '@/components/FeatureCard'
import ChatbotWidget from '@/components/ChatbotWidget'
import SourcesPage from '@/components/pages/SourcesPage'
import CALMBrowserPage from '@/components/pages/CALMBrowserPage'
import SolutionAdvisorModal from '@/components/modals/SolutionAdvisorModal'
import SpecAssistantModal from '@/components/modals/SpecAssistantModal'
import PromptGeneratorModal from '@/components/modals/PromptGeneratorModal'
import ExplainCodeModal from '@/components/modals/ExplainCodeModal'
import TestCaseGeneratorModal from '@/components/modals/TestCaseGeneratorModal'
import CodeAdvisorModal from '@/components/modals/CodeAdvisorModal'
import DocumentUploadModal from '@/components/modals/DocumentUploadModal'
import SettingsModal from '@/components/modals/SettingsModal'

interface Source {
  id: string
  name: string
  type: 'CALM' | 'SharePoint' | 'SolMan'
  status: 'connected' | 'disconnected' | 'error'
  lastSync: string | null
  config: {
    apiEndpoint?: string
    tokenUrl?: string
  }
}

export default function Home() {
  const [activePage, setActivePage] = useState('dashboard')
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [chatbotMinimized, setChatbotMinimized] = useState(false)
  const [browsingSource, setBrowsingSource] = useState<Source | null>(null)

  const features = [
    {
      id: 'ask-yoda',
      title: 'Ask Yoda',
      description: 'Natural-language Q&A powered by RAG. Query historical blueprints, specs, tickets, and test cases instantly.',
      icon: '🧠',
      variant: 'purple' as const
    },
    {
      id: 'solution-advisor',
      title: 'Solution Advisor',
      description: 'Conversational advisor to gather requirements, explore existing solutions, and prepare for spec generation.',
      icon: '💡',
      variant: 'cyan' as const
    },
    {
      id: 'spec-assistant',
      title: 'Spec Assistant',
      description: 'Generate functional and technical specification documents with AI. Preview, edit, and export to PDF or DOCX.',
      icon: '📄',
      variant: 'pink' as const
    },
    {
      id: 'prompt-generator',
      title: 'Prompt Generator',
      description: 'Create optimized prompts for LLM code generation. Support for ABAP, Python, JavaScript, and more.',
      icon: '⚡',
      variant: 'orange' as const
    },
    {
      id: 'test-case-generator',
      title: 'Test Case Generator',
      description: 'Generate manual test cases and ABAP Unit test skeletons. Export to Excel, Word, or Jira/Xray.',
      icon: '🧪',
      variant: 'green' as const
    },
    {
      id: 'explain-code',
      title: 'Explain Code',
      description: 'Enter ABAP program, class, or function names. Fetch code from SAP and get intelligent explanations.',
      icon: '💻',
      variant: 'purple' as const
    },
    {
      id: 'code-advisor',
      title: 'Code Advisor',
      description: 'Analyze ABAP code for anti-patterns and get improvement recommendations with diff-style suggestions.',
      icon: '🛡️',
      variant: 'cyan' as const
    },
    {
      id: 'sources',
      title: 'Source Configuration',
      description: 'Connect to Cloud ALM, SharePoint, or SolMan. Browse and sync documents to the knowledge base.',
      icon: '🔌',
      variant: 'pink' as const
    }
  ]

  const handleNavigation = (item: string) => {
    if (item === 'ask-yoda') {
      setChatbotOpen(true)
      setChatbotMinimized(false)
    } else if (['solution-advisor', 'spec-assistant', 'prompt-generator', 'explain-code', 'test-case-generator', 'code-advisor', 'documents'].includes(item)) {
      if (item === 'documents') {
        setActiveModal('document-upload')
      } else {
        setActiveModal(item)
      }
    } else {
      setActivePage(item)
      setBrowsingSource(null)
    }
  }

  const handleFeatureClick = (featureId: string) => {
    if (featureId === 'ask-yoda') {
      setChatbotOpen(true)
      setChatbotMinimized(false)
    } else if (featureId === 'sources') {
      setActivePage('sources')
    } else {
      setActiveModal(featureId)
    }
  }

  const closeModal = () => {
    setActiveModal(null)
  }

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard'
      case 'sources': return 'Sources'
      case 'settings': return 'Settings'
      default: return 'Dashboard'
    }
  }

  const getPageSubtitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Welcome to MYGO AI Ecosystem'
      case 'sources': return 'Manage your data sources and connections'
      case 'settings': return 'Configure your preferences'
      default: return ''
    }
  }

  const renderContent = () => {
    // If browsing a source, show the CALM browser
    if (browsingSource) {
      return (
        <DashboardLayout
          title={`Browsing: ${browsingSource.name}`}
          subtitle="Cloud ALM Document Browser"
        >
          <CALMBrowserPage
            sourceId={browsingSource.id}
            sourceName={browsingSource.name}
            onBack={() => setBrowsingSource(null)}
          />
        </DashboardLayout>
      )
    }

    switch (activePage) {
      case 'sources':
        return (
          <DashboardLayout
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
          >
            <SourcesPage
              onBrowseSource={(source) => setBrowsingSource(source)}
            />
          </DashboardLayout>
        )

      case 'settings':
        return (
          <DashboardLayout
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
          >
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-xl font-semibold text-white mb-2">Settings</h3>
              <p className="text-gray-400 mb-4">Configure your AI ecosystem preferences</p>
              <button
                className="btn btn-primary"
                onClick={() => setActiveModal('settings')}
              >
                Open Settings
              </button>
            </div>
          </DashboardLayout>
        )

      case 'dashboard':
      default:
        return (
          <DashboardLayout
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
          >
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Documents</p>
                    <p className="text-2xl font-bold text-white mt-1">24</p>
                  </div>
                  <div className="text-3xl opacity-50">📄</div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Sources</p>
                    <p className="text-2xl font-bold text-white mt-1">3</p>
                  </div>
                  <div className="text-3xl opacity-50">🔌</div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Queries Today</p>
                    <p className="text-2xl font-bold text-white mt-1">47</p>
                  </div>
                  <div className="text-3xl opacity-50">🧠</div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Specs Generated</p>
                    <p className="text-2xl font-bold text-white mt-1">12</p>
                  </div>
                  <div className="text-3xl opacity-50">📋</div>
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <h2 className="text-lg font-semibold text-white mb-4">AI Tools</h2>
            <div className="feature-grid">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  id={feature.id}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  variant={feature.variant}
                  onClick={() => handleFeatureClick(feature.id)}
                />
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  className="btn btn-primary"
                  onClick={() => { setChatbotOpen(true); setChatbotMinimized(false) }}
                >
                  🧠 Ask Yoda
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveModal('document-upload')}
                >
                  📤 Upload Documents
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActivePage('sources')}
                >
                  🔌 Manage Sources
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveModal('spec-assistant')}
                >
                  📄 Create Spec
                </button>
              </div>
            </div>
          </DashboardLayout>
        )
    }
  }

  return (
    <div className="min-h-screen">
      {/* Animated Background */}
      <div className="animated-background" />

      {/* Sidebar */}
      <Sidebar
        activeItem={activePage}
        onItemClick={handleNavigation}
      />

      {/* Main Content */}
      {renderContent()}

      {/* Modals */}
      {activeModal === 'document-upload' && (
        <DocumentUploadModal onClose={closeModal} />
      )}
      {activeModal === 'solution-advisor' && (
        <SolutionAdvisorModal
          onClose={closeModal}
          onCreateSpec={(solutionContext) => {
            setActiveModal('spec-assistant')
            sessionStorage.setItem('solutionAdvisorContext', solutionContext)
          }}
        />
      )}
      {activeModal === 'spec-assistant' && (
        <SpecAssistantModal onClose={closeModal} />
      )}
      {activeModal === 'prompt-generator' && (
        <PromptGeneratorModal onClose={closeModal} />
      )}
      {activeModal === 'explain-code' && (
        <ExplainCodeModal onClose={closeModal} />
      )}
      {activeModal === 'test-case-generator' && (
        <TestCaseGeneratorModal onClose={closeModal} />
      )}
      {activeModal === 'code-advisor' && (
        <CodeAdvisorModal onClose={closeModal} />
      )}
      {activeModal === 'settings' && (
        <SettingsModal onClose={closeModal} />
      )}

      {/* Chatbot Widget */}
      <ChatbotWidget
        isOpen={chatbotOpen}
        isMinimized={chatbotMinimized}
        onToggleOpen={() => {
          setChatbotOpen(!chatbotOpen)
          if (!chatbotOpen) setChatbotMinimized(false)
        }}
        onToggleMinimize={() => {
          setChatbotMinimized(!chatbotMinimized)
        }}
        onClose={() => {
          setChatbotOpen(false)
          setChatbotMinimized(false)
        }}
      />
    </div>
  )
}
