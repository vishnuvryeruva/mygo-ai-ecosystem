'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'

interface CodeAdvisorModalProps {
  onClose: () => void
}

interface Suggestion {
  line: number
  type: string
  current: string
  suggested: string
  reason: string
}

interface AntiPattern {
  line: number
  pattern: string
  description: string
  severity: string
  suggestion: string
}

export default function CodeAdvisorModal({ onClose }: CodeAdvisorModalProps) {
  const [code, setCode] = useState('')
  const [codeType, setCodeType] = useState('ABAP')
  const [analysis, setAnalysis] = useState<{
    suggestions: Suggestion[]
    anti_patterns: AntiPattern[]
    improvements: any[]
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    try {
      const response = await axios.post('/api/analyze-code', {
        code,
        code_type: codeType
      })
      setAnalysis(response.data)
    } catch (error) {
      console.error('Error analyzing code:', error)
      alert('Error analyzing code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Code Advisor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleAnalyze}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code Type
              </label>
              <select
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ABAP">ABAP</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code for analysis..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                rows={12}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" text="Analyzing..." /> : 'Analyze Code'}
            </button>
          </form>

          {analysis && (
            <div className="mt-6 space-y-6">
              {/* Anti-patterns */}
              {analysis.anti_patterns && analysis.anti_patterns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-3">Anti-patterns Found:</h3>
                  <div className="space-y-3">
                    {analysis.anti_patterns.map((ap, idx) => (
                      <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-red-900">{ap.pattern}</p>
                            <p className="text-sm text-red-700 mt-1">{ap.description}</p>
                            <p className="text-sm text-red-600 mt-2">Suggestion: {ap.suggestion}</p>
                          </div>
                          <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                            Line {ap.line} • {ap.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-blue-600 mb-3">Improvement Suggestions:</h3>
                  <div className="space-y-4">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-200 p-4 rounded">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                            Line {suggestion.line} • {suggestion.type}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Current:</p>
                            <pre className="bg-white p-2 rounded text-xs overflow-x-auto">{suggestion.current}</pre>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Suggested:</p>
                            <pre className="bg-green-50 p-2 rounded text-xs overflow-x-auto">{suggestion.suggested}</pre>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvements */}
              {analysis.improvements && analysis.improvements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">General Improvements:</h3>
                  <div className="space-y-2">
                    {analysis.improvements.map((imp, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{imp.category}</p>
                            <p className="text-sm text-gray-700 mt-1">{imp.description}</p>
                          </div>
                          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                            {imp.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

