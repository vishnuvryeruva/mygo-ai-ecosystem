'use client'

import { useState } from 'react'
import axios from 'axios'
import RichTextResponse from '../RichTextResponse'

interface PromptGeneratorModalProps {
  onClose: () => void
}

export default function PromptGeneratorModal({ onClose }: PromptGeneratorModalProps) {
  const [language, setLanguage] = useState('ABAP')
  const [taskDescription, setTaskDescription] = useState('')
  const [context, setContext] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  // Conversational refinement state
  const [refinementMode, setRefinementMode] = useState(false)
  const [refinementInput, setRefinementInput] = useState('')
  const [refinementHistory, setRefinementHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskDescription.trim()) return

    setLoading(true)
    setRefinementMode(false)
    setRefinementHistory([])

    try {
      const response = await axios.post('/api/generate-prompt', {
        language,
        task: taskDescription,
        context
      })
      setPrompt(response.data.prompt)
      setRefinementMode(true)
    } catch (error) {
      console.error('Error generating prompt:', error)
      alert('Error generating prompt. Please try again.')
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
      const response = await axios.post('/api/generate-prompt', {
        language,
        task: `${taskDescription}\n\n[Previous Prompt]:\n${prompt}\n\n[Refinement Request]:\n${userRequest}`,
        context
      })

      setPrompt(response.data.prompt)
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve updated the prompt based on your feedback.'
      }])
    } catch (error) {
      console.error('Error refining prompt:', error)
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Error refining prompt. Please try again.'
      }])
    } finally {
      setLoading(false)
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
      <div className="modal max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Prompt Generator
            </h2>
            {refinementMode && (
              <p className="text-sm text-muted mt-1">Conversational mode - refine your prompt</p>
            )}
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          {!refinementMode ? (
            // Initial form
            <form onSubmit={handleGenerate}>
              <div className="input-group">
                <label className="input-label">Programming Language / Framework</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input select"
                >
                  <optgroup label="SAP Technologies">
                    <option value="ABAP">ABAP (Traditional)</option>
                    <option value="ABAP_RAP">ABAP RAP</option>
                    <option value="CAP_NODEJS">CAP (Node.js)</option>
                    <option value="CAP_JAVA">CAP (Java)</option>
                  </optgroup>
                  <optgroup label="Other Languages">
                    <option value="Python">Python</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="Java">Java</option>
                    <option value="TypeScript">TypeScript</option>
                  </optgroup>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Task Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the code generation task..."
                  className="input"
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Additional Context (Optional)</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add any additional context or requirements..."
                  className="input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !taskDescription.trim()}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner w-4 h-4" />
                    Generating...
                  </span>
                ) : 'Generate Prompt'}
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
                        : 'bg-white/5 border border-white/10 text-muted mr-8'
                        }`}
                    >
                      <strong>{msg.role === 'user' ? 'You: ' : 'Assistant: '}</strong>
                      {msg.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Generated Prompt */}
              <div className="glass-subtle p-4">
                <RichTextResponse
                  content={prompt}
                  title="Generated Prompt"
                  showCopy={true}
                  showDownload={false}
                  collapsible={false}
                />
              </div>

              {/* Refinement suggestions */}
              <div className="glass-subtle p-4">
                <h4 className="font-medium text-indigo-300 mb-3">💡 Refinement Suggestions</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Add more context about the data model',
                    'Include error handling requirements',
                    'Make it more specific to SAP standards',
                    'Add performance considerations',
                    'Include unit test requirements'
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
                  setPrompt('')
                  setRefinementHistory([])
                }}
                className="text-muted hover:text-main text-sm underline"
              >
                ← Start over with new task
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
