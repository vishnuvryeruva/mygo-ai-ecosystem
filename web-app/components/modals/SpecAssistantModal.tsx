'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'

interface SpecAssistantModalProps {
  onClose: () => void
}

export default function SpecAssistantModal({ onClose }: SpecAssistantModalProps) {
  const [requirements, setRequirements] = useState('')
  const [specType, setSpecType] = useState('functional')
  const [loading, setLoading] = useState(false)
  const [specContent, setSpecContent] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Conversational refinement state
  const [refinementMode, setRefinementMode] = useState(false)
  const [refinementInput, setRefinementInput] = useState('')
  const [refinementHistory, setRefinementHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([])

  // Check for context from Solution Advisor
  useEffect(() => {
    const context = sessionStorage.getItem('solutionAdvisorContext')
    if (context) {
      setRequirements(context)
      sessionStorage.removeItem('solutionAdvisorContext')
    }
  }, [])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requirements.trim()) return

    setLoading(true)
    setSpecContent('')
    setRefinementMode(false)
    setRefinementHistory([])

    try {
      const response = await axios.post('/api/generate-spec', {
        type: specType,
        requirements,
        format: 'preview'
      })
      setSpecContent(response.data.spec)
      setRefinementMode(true)
    } catch (error) {
      console.error('Error generating spec:', error)
      alert('Error generating specification. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefinement = async () => {
    if (!refinementInput.trim() || loading) return

    const userRequest = refinementInput.trim()
    setRefinementInput('')
    setRefinementHistory(prev => [...prev, { role: 'user', content: userRequest }])
    setLoading(true)

    try {
      const response = await axios.post('/api/generate-spec', {
        type: specType,
        requirements: `${requirements}\n\n[Previous Specification]:\n${specContent}\n\n[Refinement Request]:\n${userRequest}`,
        format: 'preview'
      })

      setSpecContent(response.data.spec)
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve updated the specification based on your feedback.'
      }])
    } catch (error) {
      console.error('Error refining spec:', error)
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Error refining specification. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format: 'docx' | 'pdf' | 'excel') => {
    if (!specContent) return

    setDownloadLoading(true)
    try {
      const response = await axios.post('/api/generate-spec', {
        type: specType,
        requirements,
        format: format
      }, {
        responseType: 'blob'
      })

      if (response.data.type === 'application/json') {
        const text = await response.data.text()
        console.error('Received JSON error instead of Blob:', text)
        try {
          const json = JSON.parse(text)
          alert('Error downloading: ' + (json.error || 'Unknown error'))
        } catch (e) {
          alert('Error downloading: ' + text)
        }
        return
      }

      const mimeType = format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf'

      const extension = format === 'docx' ? 'docx' : 'pdf'

      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${specType}_specification.${extension}`
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }, 100)
    } catch (error) {
      console.error('Error downloading spec:', error)
      alert('Error downloading specification. Please try again.')
    } finally {
      setDownloadLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRefinement()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📄 Spec Assistant</h2>
            {refinementMode && (
              <p className="text-sm text-gray-500 mt-1">Conversational mode - refine your specification</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!refinementMode ? (
            // Initial form
            <form onSubmit={handleGenerate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specification Type
                </label>
                <select
                  value={specType}
                  onChange={(e) => setSpecType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="functional">Functional</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Describe the requirements for the specification..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !requirements.trim()}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Specification'}
              </button>
            </form>
          ) : (
            // Conversational refinement mode
            <div className="space-y-4">
              {/* Refinement History */}
              {refinementHistory.length > 0 && (
                <div className="mb-4 space-y-2">
                  {refinementHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-sm ${msg.role === 'user'
                          ? 'bg-orange-100 text-orange-800 ml-8'
                          : 'bg-gray-100 text-gray-800 mr-8'
                        }`}
                    >
                      <strong>{msg.role === 'user' ? 'You: ' : 'Assistant: '}</strong>
                      {msg.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Generated Specification */}
              {downloadLoading && (
                <div className="mb-4 flex items-center justify-center text-gray-600">
                  <LoadingSpinner size="sm" text="Preparing download..." />
                </div>
              )}
              <RichTextResponse
                content={specContent}
                title={`${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`}
                showCopy={true}
                showDownload={true}
                onDownload={handleDownload}
                collapsible={true}
              />

              {/* Refinement suggestions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">💡 Refinement Suggestions</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Add error handling section',
                    'Make scope more detailed',
                    'Add acceptance criteria',
                    'Include integration points',
                    'Add data model section'
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setRefinementInput(suggestion)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Over Button */}
              <button
                onClick={() => {
                  setRefinementMode(false)
                  setSpecContent('')
                  setRefinementHistory([])
                }}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                ← Start over with new requirements
              </button>
            </div>
          )}
        </div>

        {/* Refinement Input (only in refinement mode) */}
        {refinementMode && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <input
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask for improvements or provide additional inputs..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleRefinement}
                disabled={loading || !refinementInput.trim()}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Refine'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
