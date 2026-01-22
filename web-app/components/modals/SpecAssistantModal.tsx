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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-5xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title flex items-center gap-2">
              <span className="text-2xl">📄</span>
              Spec Assistant
            </h2>
            {refinementMode && (
              <p className="text-sm text-gray-400 mt-1">Conversational mode - refine your specification</p>
            )}
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          {!refinementMode ? (
            // Initial form
            <form onSubmit={handleGenerate}>
              <div className="input-group">
                <label className="input-label">Specification Type</label>
                <select
                  value={specType}
                  onChange={(e) => setSpecType(e.target.value)}
                  className="input select"
                >
                  <option value="functional">Functional</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Requirements</label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Describe the requirements for the specification..."
                  className="input"
                  rows={6}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !requirements.trim()}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner w-4 h-4" />
                    Generating...
                  </span>
                ) : 'Generate Specification'}
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
                      className={`p-3 rounded-xl text-sm ${msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-200 ml-8'
                        : 'bg-white/5 border border-white/10 text-gray-300 mr-8'
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
                <div className="mb-4 flex items-center justify-center text-gray-400">
                  <div className="spinner w-4 h-4 mr-2" />
                  Preparing download...
                </div>
              )}

              <div className="glass-subtle p-4">
                <RichTextResponse
                  content={specContent}
                  title={`${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`}
                  showCopy={true}
                  showDownload={true}
                  onDownload={handleDownload}
                  collapsible={true}
                />
              </div>

              {/* Refinement suggestions */}
              <div className="glass-subtle p-4">
                <h4 className="font-medium text-indigo-300 mb-3">💡 Refinement Suggestions</h4>
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
                      className="px-3 py-1.5 bg-indigo-500/10 text-indigo-300 rounded-full text-sm hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors"
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
                className="text-gray-500 hover:text-gray-300 text-sm underline"
              >
                ← Start over with new requirements
              </button>
            </div>
          )}
        </div>

        {/* Refinement Input (only in refinement mode) */}
        {refinementMode && (
          <div className="modal-footer">
            <div className="flex gap-3 w-full">
              <input
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask for improvements or provide additional inputs..."
                className="input flex-1"
                disabled={loading}
              />
              <button
                onClick={handleRefinement}
                disabled={loading || !refinementInput.trim()}
                className="btn btn-primary"
              >
                {loading ? <span className="spinner w-4 h-4" /> : 'Refine'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
