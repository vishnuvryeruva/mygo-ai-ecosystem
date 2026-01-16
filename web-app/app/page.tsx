'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import FeatureCard from '@/components/FeatureCard'
import ChatbotWidget from '@/components/ChatbotWidget'
import SolutionAdvisorModal from '@/components/modals/SolutionAdvisorModal'
import SpecAssistantModal from '@/components/modals/SpecAssistantModal'
import PromptGeneratorModal from '@/components/modals/PromptGeneratorModal'
import ExplainCodeModal from '@/components/modals/ExplainCodeModal'
import TestCaseGeneratorModal from '@/components/modals/TestCaseGeneratorModal'
import CodeAdvisorModal from '@/components/modals/CodeAdvisorModal'
import DocumentUploadModal from '@/components/modals/DocumentUploadModal'
import SettingsModal from '@/components/modals/SettingsModal'

export default function Home() {
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [chatbotMinimized, setChatbotMinimized] = useState(false)

  const features: {
    id: string
    title: string
    description: string
    icon: string
    color: 'orange' | 'teal'
  }[] = [
      {
        id: 'ask-yoda',
        title: 'Ask Yoda',
        description: 'Natural-language Q&A powered by RAG. Query historical blueprints, specs, tickets, and test cases instantly.',
        icon: '🧠',
        color: 'orange'
      },
      {
        id: 'document-upload',
        title: 'Document Upload',
        description: 'Upload and manage knowledge base documents. Add PDFs, DOCX, or TXT files for RAG-powered Q&A.',
        icon: '📤',
        color: 'teal'
      },
      {
        id: 'solution-advisor',
        title: 'Solution Advisor',
        description: 'Conversational advisor to gather requirements, explore existing solutions, and prepare for spec generation.',
        icon: '💡',
        color: 'orange'
      },
      {
        id: 'spec-assistant',
        title: 'Spec Assistant',
        description: 'Generate functional and technical specification documents with AI. Preview, edit, and export to PDF or DOCX.',
        icon: '📄',
        color: 'teal'
      },
      {
        id: 'prompt-generator',
        title: 'Prompt Generator',
        description: 'Create optimized prompts for LLM code generation. Support for ABAP, Python, JavaScript, and more.',
        icon: '⚡',
        color: 'orange'
      },
      {
        id: 'test-case-generator',
        title: 'Test Case Generator',
        description: 'Generate manual test cases and ABAP Unit test skeletons. Export to Excel, Word, or Jira/Xray.',
        icon: 'A',
        color: 'teal'
      },
      {
        id: 'explain-code',
        title: 'Explain Code',
        description: 'Enter ABAP program, class, or function names. Fetch code from SAP and get intelligent explanations.',
        icon: '</>',
        color: 'orange'
      },
      {
        id: 'code-advisor',
        title: 'Code Advisor',
        description: 'Analyze ABAP code for anti-patterns and get improvement recommendations with diff-style suggestions.',
        icon: '🛡️',
        color: 'teal'
      }
    ]

  const handleFeatureClick = (featureId: string) => {
    console.log('Feature clicked:', featureId)
    if (featureId === 'ask-yoda') {
      setChatbotOpen(true)
      setChatbotMinimized(false)
    } else {
      setActiveModal(featureId)
    }
  }

  const closeModal = () => {
    setActiveModal(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header onSettingsClick={() => setShowSettings(true)} />

      <main className="container mx-auto px-4 py-4">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              onClick={() => handleFeatureClick(feature.id)}
            />
          ))}
        </div>

        {/* Call to Action */}
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-base text-gray-600">
            Select a feature above to get started with AI-powered SAP assistance.
          </p>
        </div>
      </main>

      {/* Modals */}
      {activeModal === 'document-upload' && (
        <DocumentUploadModal onClose={closeModal} />
      )}
      {activeModal === 'solution-advisor' && (
        <SolutionAdvisorModal
          onClose={closeModal}
          onCreateSpec={(solutionContext) => {
            // Close Solution Advisor and open Spec Assistant with context
            setActiveModal('spec-assistant')
            // Store context for Spec Assistant (could use state or context API)
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
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
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

