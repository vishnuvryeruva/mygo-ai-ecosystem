'use client'

import { useState } from 'react'
import axios from 'axios'

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-5xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            Code Advisor
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleAnalyze}>
            <div className="input-group">
              <label className="input-label">Code Type</label>
              <select
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
                className="input select"
              >
                <option value="ABAP">ABAP</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code for analysis..."
                className="input font-mono text-sm"
                rows={12}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner w-4 h-4" />
                  Analyzing...
                </span>
              ) : 'Analyze Code'}
            </button>
          </form>

          {analysis && (
            <div className="mt-6 space-y-6">
              {/* Anti-patterns */}
              {analysis.anti_patterns && analysis.anti_patterns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-400 mb-3">⚠️ Anti-patterns Found:</h3>
                  <div className="space-y-3">
                    {analysis.anti_patterns.map((ap, idx) => (
                      <div key={idx} className="glass-subtle p-4 border-l-4 border-red-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-red-300">{ap.pattern}</p>
                            <p className="text-sm text-gray-400 mt-1">{ap.description}</p>
                            <p className="text-sm text-red-300/80 mt-2">💡 {ap.suggestion}</p>
                          </div>
                          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30">
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
                  <h3 className="font-semibold text-indigo-400 mb-3">💡 Improvement Suggestions:</h3>
                  <div className="space-y-4">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="glass-subtle p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">
                            Line {suggestion.line} • {suggestion.type}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-400 mb-1">Current:</p>
                            <pre className="bg-black/30 p-2 rounded text-xs overflow-x-auto text-red-300 border border-red-500/20">{suggestion.current}</pre>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 mb-1">Suggested:</p>
                            <pre className="bg-black/30 p-2 rounded text-xs overflow-x-auto text-green-300 border border-green-500/20">{suggestion.suggested}</pre>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-3">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvements */}
              {analysis.improvements && analysis.improvements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-white mb-3">📋 General Improvements:</h3>
                  <div className="space-y-2">
                    {analysis.improvements.map((imp, idx) => (
                      <div key={idx} className="glass-subtle p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-white">{imp.category}</p>
                            <p className="text-sm text-gray-400 mt-1">{imp.description}</p>
                          </div>
                          <span className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded border border-white/10">
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
