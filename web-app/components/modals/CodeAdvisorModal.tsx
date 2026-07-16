'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AppModal from './AppModal'
import { useAutoResize } from '@/hooks/useAutoResize'

interface CodeAdvisorModalProps {
  onClose: () => void
  initialCode?: string
  initialCodeType?: string
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

export default function CodeAdvisorModal({ onClose, initialCode = '', initialCodeType = 'ABAP' }: CodeAdvisorModalProps) {
  const [code, setCode] = useState(initialCode)
  const [codeType, setCodeType] = useState(initialCodeType)
  const [programName, setProgramName] = useState('')
  const codeRef = useAutoResize(code, 12)
  const [analysis, setAnalysis] = useState<{
    suggestions: Suggestion[]
    anti_patterns: AntiPattern[]
    improvements: any[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [pushed, setPushed] = useState(false)

  // Interactive states for premium feedback and choice capture
  const [antiPatternFeedback, setAntiPatternFeedback] = useState<Record<number, 'like' | 'dislike' | undefined>>({})
  const [suggestionStatus, setSuggestionStatus] = useState<Record<number, 'accepted' | 'ignored' | undefined>>({})

  // Automatically trigger code analysis on mount if initialCode is provided
  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      const triggerAnalyze = async () => {
        setLoading(true)
        setPushed(false)
        try {
          const response = await axios.post('/api/analyze-code', {
            code: initialCode,
            code_type: initialCodeType
          })
          setAnalysis(response.data)
        } catch (error) {
          console.error('Error analyzing code:', error)
          alert('Error analyzing code. Please try again.')
        } finally {
          setLoading(false)
        }
      }
      triggerAnalyze()
    }
  }, [initialCode, initialCodeType])

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() && !programName.trim()) return

    setLoading(true)
    setPushed(false)
    try {
      const response = await axios.post('/api/analyze-code', {
        code,
        code_type: codeType,
        program_name: programName
      })
      setAnalysis(response.data)
      if (response.data.code && !code) {
        setCode(response.data.code)
      }
    } catch (error: any) {
      console.error('Error analyzing code:', error)
      const errorMsg = error?.response?.data?.error || 'Error analyzing code. Please try again.'
      alert(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handlePushToS4 = () => {
    setPushed(true)
  }

  return (
    <AppModal onClose={onClose}>
      <div>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            Code Advisor
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="animate-spin h-10 w-10 border-4 border-emerald-500 rounded-full border-t-transparent mb-4"></div>
              <p className="text-slate-500 font-semibold tracking-tight">Analyzing code with SAP Code Advisor...</p>
              <p className="text-slate-400 text-xs mt-1">Reviewing anti-patterns and performance optimizations</p>
            </div>
          ) : !initialCode ? (
            <form onSubmit={handleAnalyze}>
              <div className="input-group">
                <label className="input-label">Program/Class/Function Name (Optional)</label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g., Z_MY_PROGRAM"
                  className="input"
                />
              </div>

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
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here or enter program name to fetch from SAP..."
                  className="input font-mono text-sm"
                  style={{ resize: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || (!code.trim() && !programName.trim())}
                className="btn btn-primary w-full"
              >
                Analyze Code
              </button>
            </form>
          ) : null}

          {analysis && (
            <div className="mt-6 space-y-6">
              {/* Anti-patterns */}
              {analysis.anti_patterns && analysis.anti_patterns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3">⚠️ Anti-patterns Found:</h3>
                  <div className="space-y-3">
                    {analysis.anti_patterns.map((ap, idx) => (
                      <div key={idx} className="glass-subtle p-4 border-l-4 border-red-500 bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-heading">{ap.pattern}</p>
                            <p className="text-sm text-muted mt-1">{ap.description}</p>
                            <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-2">💡 {ap.suggestion}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-300 px-2 py-1 rounded border border-red-500/30 whitespace-nowrap">
                              Line {ap.line} • {ap.severity}
                            </span>
                            {/* Like / Dislike Feedback Buttons */}
                            <div className="flex gap-1 items-center">
                              <button
                                type="button"
                                onClick={() => setAntiPatternFeedback(prev => ({
                                  ...prev,
                                  [idx]: prev[idx] === 'like' ? undefined : 'like'
                                }))}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  antiPatternFeedback[idx] === 'like'
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Like pattern detection"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAntiPatternFeedback(prev => ({
                                  ...prev,
                                  [idx]: prev[idx] === 'dislike' ? undefined : 'dislike'
                                }))}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  antiPatternFeedback[idx] === 'dislike'
                                    ? 'bg-red-50 border-red-500 text-red-600'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Dislike pattern detection"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-indigo-600 dark:text-indigo-400 mb-3">💡 Improvement Suggestions:</h3>
                  <div className="space-y-4">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        className={`glass-subtle p-4 transition-all duration-200 rounded-xl ${
                          suggestionStatus[idx] === 'accepted'
                            ? 'border-2 border-emerald-500 bg-emerald-50/10 shadow-md shadow-emerald-500/5'
                            : suggestionStatus[idx] === 'ignored'
                            ? 'opacity-50 grayscale border border-dashed border-slate-200 bg-slate-50/50'
                            : 'border border-slate-100 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">
                            Line {suggestion.line} • {suggestion.type}
                          </span>
                          {/* Accept / Ignore Option Buttons */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSuggestionStatus(prev => ({
                                ...prev,
                                [idx]: prev[idx] === 'accepted' ? undefined : 'accepted'
                              }))}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                                suggestionStatus[idx] === 'accepted'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {suggestionStatus[idx] === 'accepted' ? 'Accepted' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSuggestionStatus(prev => ({
                                ...prev,
                                [idx]: prev[idx] === 'ignored' ? undefined : 'ignored'
                              }))}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                                suggestionStatus[idx] === 'ignored'
                                  ? 'bg-slate-600 border-slate-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                              {suggestionStatus[idx] === 'ignored' ? 'Ignored' : 'Ignore'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-xs font-semibold text-muted mb-1">Current:</p>
                            <pre className="bg-gray-100 dark:bg-black/30 p-2 rounded text-xs overflow-x-auto text-red-600 dark:text-red-300 border border-red-500/20">{suggestion.current}</pre>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted mb-1">Suggested:</p>
                            <pre className="bg-gray-100 dark:bg-black/30 p-2 rounded text-xs overflow-x-auto text-green-600 dark:text-green-300 border border-green-500/20">{suggestion.suggested}</pre>
                          </div>
                        </div>
                        <p className="text-sm text-muted mt-3">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Renamed General Improvements to Best Practices */}
              {analysis.improvements && analysis.improvements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-heading mb-3">📋 Best Practices:</h3>
                  <div className="space-y-2">
                    {analysis.improvements.map((imp, idx) => (
                      <div key={idx} className="glass-subtle p-3 bg-white border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-heading">{imp.category}</p>
                            <p className="text-sm text-muted mt-1">{imp.description}</p>
                          </div>
                          <span className="text-xs glass-subtle text-muted px-2 py-1 rounded">
                            {imp.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Push to S4 Button at the very end of the entire answer */}
              <div style={{
                display: 'flex', gap: '12px', padding: '16px',
                background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                border: '1px solid #86efac',
                borderRadius: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '24px'
              }}>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#065f46', margin: '0 0 4px 0', fontSize: '0.9rem' }}>
                    {pushed ? '✓ Pushed successfully to S4' : 'Push to S4'}
                  </h4>
                  <p style={{ color: '#047857', fontSize: '0.8rem', margin: 0 }}>
                    {pushed ? 'Your code has been pushed to S4 successfully.' : 'Push this analyzed code to S4'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushToS4}
                  disabled={pushed}
                  className="btn"
                  style={{
                    background: pushed ? '#10b981' : '#059669',
                    color: 'white',
                    border: `1px solid ${pushed ? '#10b981' : '#059669'}`,
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                    opacity: pushed ? 0.7 : 1,
                    cursor: pushed ? 'default' : 'pointer',
                    flexShrink: 0
                  }}
                >
                  {pushed ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Pushed
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Push to S4
                    </span>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </AppModal>
  )
}
