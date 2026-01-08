'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">⚡ Prompt Generator</h2>
            {refinementMode && (
              <p className="text-sm text-gray-500 mt-1">Conversational mode - refine your prompt</p>
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
                  Programming Language / Framework
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the code generation task..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={4}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Context (Optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add any additional context or requirements..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !taskDescription.trim()}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Prompt'}
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

              {/* Generated Prompt */}
              <RichTextResponse
                content={prompt}
                title="Generated Prompt"
                showCopy={true}
                showDownload={false}
                collapsible={false}
              />

              {/* Refinement suggestions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">💡 Refinement Suggestions</h4>
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
                  setPrompt('')
                  setRefinementHistory([])
                }}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                ← Start over with new task
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
