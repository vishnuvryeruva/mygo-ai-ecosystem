'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import TopHeader from '@/components/TopHeader'
import ChatbotWidget from '@/components/ChatbotWidget'
import QuickActionsFAB from '@/components/QuickActionsFAB'
import LoginPage from '@/components/LoginPage'
import DocumentHubPage from '@/components/pages/DocumentHubPage'
import SettingsPage from '@/components/pages/SettingsPage'
import AgentBuilderPage from '@/components/pages/AgentBuilderPage'
import SolutionAdvisorModal from '@/components/modals/SolutionAdvisorModal'
import SpecAssistantModal from '@/components/modals/SpecAssistantModal'
import PromptGeneratorModal from '@/components/modals/PromptGeneratorModal'
import ExplainCodeModal from '@/components/modals/ExplainCodeModal'
import TestCaseGeneratorModal from '@/components/modals/TestCaseGeneratorModal'
import CodeAdvisorModal from '@/components/modals/CodeAdvisorModal'
import SettingsModal from '@/components/modals/SettingsModal'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [chatbotMinimized, setChatbotMinimized] = useState(false)
  const [activeAgent, setActiveAgent] = useState<string | null>('ask-yoda')

  // Check auth on mount
  useEffect(() => {
    const auth = localStorage.getItem('mygo-auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
    setAuthChecked(true)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('mygo-auth')
    localStorage.removeItem('mygo-user')
    setIsAuthenticated(false)
  }

  const handleNavigation = (item: string) => {
    setActivePage(item)
  }

  const handleAgentSelect = (agentId: string) => {
    setActiveAgent(agentId)

    if (agentId === 'ask-yoda') {
      setChatbotOpen(true)
      setChatbotMinimized(false)
    } else if (agentId === 'sync-documents') {
      // Trigger sync — open chatbot with sync context
      setActiveAgent('sync-documents')
      setChatbotOpen(true)
      setChatbotMinimized(false)
    } else if (['solution-advisor', 'spec-assistant', 'prompt-generator', 'explain-code', 'test-case-generator', 'code-advisor'].includes(agentId)) {
      // Open the corresponding modal AND activate Yoda with agent context
      setActiveModal(agentId)
      setChatbotOpen(true)
      setChatbotMinimized(true)
    }
  }

  const handleQuickAction = (actionId: string) => {
    handleAgentSelect(actionId)
    if (actionId === 'document-upload') {
      setActivePage('document-hub')
    }
  }

  const closeModal = () => setActiveModal(null)

  // Don't render until auth check completes
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  // Stats data for dashboard
  const stats = [
    {
      title: 'Total Sources', value: '4', subtitle: 'CALM, SharePoint, Jira, Solman', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      )
    },
    {
      title: 'Total Documents', value: '12', subtitle: 'Across all sources', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    },
    {
      title: 'Last Updated', value: '2/4/2026', subtitle: '7:00:00 PM', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      title: 'ABAP Objects', value: '319', subtitle: '4 object types', icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    },
  ]

  const docsByType = [
    { label: 'Solution Document', count: 3, maxCount: 5 },
    { label: 'Decision Paper', count: 2, maxCount: 5 },
    { label: 'Functional Spec', count: 2, maxCount: 5 },
    { label: 'Technical Spec', count: 3, maxCount: 5 },
    { label: 'Change document', count: 2, maxCount: 5 },
  ]

  const abapByType = [
    { label: 'Classes', count: 142, maxCount: 150 },
    { label: 'Function Modules', count: 87, maxCount: 150 },
    { label: 'Reports', count: 56, maxCount: 150 },
    { label: 'Interfaces', count: 34, maxCount: 150 },
  ]

  const renderContent = () => {
    switch (activePage) {
      case 'document-hub':
        return <DocumentHubPage onAgentSelect={handleAgentSelect} />

      case 'agents':
        return <AgentBuilderPage onAgentSelect={handleAgentSelect} />

      case 'settings':
        return <SettingsPage />

      case 'code-repository':
        return (
          <div className="page-content-area">
            <h1 className="page-main-title">Code Repository</h1>
            <p className="page-main-subtitle">Browse and analyze ABAP code objects</p>
            <div className="placeholder-card">
              <div className="placeholder-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <h3>Code Repository</h3>
              <p>ABAP code objects, classes, and function modules will appear here.</p>
            </div>
          </div>
        )

      case 'dashboard':
      default:
        return (
          <div className="page-content-area">
            <h1 className="page-main-title">Dashboard</h1>
            <p className="page-main-subtitle">Overview of your project ecosystem</p>

            {/* Stats Cards */}
            <div className="dashboard-stats-grid">
              {stats.map((stat, i) => (
                <div key={i} className="dashboard-stat-card">
                  <div className="dashboard-stat-header">
                    <span className="dashboard-stat-label">{stat.title}</span>
                    <span className="dashboard-stat-icon">{stat.icon}</span>
                  </div>
                  <div className="dashboard-stat-value">{stat.value}</div>
                  <div className="dashboard-stat-subtitle">{stat.subtitle}</div>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="dashboard-charts-grid">
              <div className="dashboard-chart-card">
                <h3 className="dashboard-chart-title">Documents by Type</h3>
                <div className="dashboard-chart-bars">
                  {docsByType.map((item, i) => (
                    <div key={i} className="dashboard-bar-row">
                      <span className="dashboard-bar-label">{item.label}</span>
                      <div className="dashboard-bar-track">
                        <div
                          className="dashboard-bar-fill"
                          style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="dashboard-bar-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-chart-card">
                <h3 className="dashboard-chart-title">ABAP Objects by Type</h3>
                <div className="dashboard-chart-bars">
                  {abapByType.map((item, i) => (
                    <div key={i} className="dashboard-bar-row">
                      <span className="dashboard-bar-label">{item.label}</span>
                      <div className="dashboard-bar-track">
                        <div
                          className="dashboard-bar-fill"
                          style={{ width: `${(item.count / item.maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="dashboard-bar-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app-layout">
      <Sidebar activeItem={activePage} onItemClick={handleNavigation} />

      <div className="app-main">
        <TopHeader
          onSettingsClick={() => setActivePage('settings')}
        />

        <div className="app-content">
          {renderContent()}
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

      {/* Chatbot Widget - agent-context aware */}
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
