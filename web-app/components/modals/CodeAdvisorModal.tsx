'use client'

import { useState } from 'react'
import axios from 'axios'

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
  const [analysis, setAnalysis] = useState<{
    suggestions: Suggestion[]
    anti_patterns: AntiPattern[]
    improvements: any[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveForm, setSaveForm] = useState({ title: '', description: '' })

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setSaved(false)
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

  const handleAddToRepository = () => {
    setSaveForm({ title: `${codeType} Code Snippet`, description: '' })
    setShowSaveDialog(true)
  }

  const handleSaveToRepository = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saveForm.title.trim()) return

    setSaving(true)
    try {
      const token = localStorage.getItem('mygo-token')
      await axios.post('/api/code-repository', {
        title: saveForm.title.trim(),
        code,
        code_type: codeType,
        description: saveForm.description.trim() || undefined,
        analysis_data: analysis
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      setSaved(true)
      setShowSaveDialog(false)
      setSaveForm({ title: '', description: '' })
    } catch (error) {
      console.error('Error saving code snippet:', error)
      alert('Error saving code snippet. Please try again.')
    } finally {
      setSaving(false)
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
              {/* Add to Repository Button */}
              <div style={{
                display: 'flex', gap: '12px', padding: '16px',
                background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                border: '1px solid #86efac',
                borderRadius: '12px',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#065f46', margin: '0 0 4px 0', fontSize: '0.9rem' }}>
                    {saved ? '✓ Saved to Repository' : 'Save this code for later'}
                  </h4>
                  <p style={{ color: '#047857', fontSize: '0.8rem', margin: 0 }}>
                    {saved ? 'You can view it in your Code Repository' : 'Add this analyzed code to your personal repository'}
                  </p>
                </div>
                <button
                  onClick={handleAddToRepository}
                  disabled={saving || saved}
                  className="btn"
                  style={{
                    background: saved ? '#10b981' : '#059669',
                    color: 'white',
                    border: `1px solid ${saved ? '#10b981' : '#059669'}`,
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                    opacity: saved ? 0.7 : 1,
                    cursor: saved ? 'default' : 'pointer',
                    flexShrink: 0
                  }}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      Saving...
                    </span>
                  ) : saved ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Saved
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Add to Repository
                    </span>
                  )}
                </button>
              </div>

              {/* Anti-patterns */}
              {analysis.anti_patterns && analysis.anti_patterns.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3">⚠️ Anti-patterns Found:</h3>
                  <div className="space-y-3">
                    {analysis.anti_patterns.map((ap, idx) => (
                      <div key={idx} className="glass-subtle p-4 border-l-4 border-red-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-heading">{ap.pattern}</p>
                            <p className="text-sm text-muted mt-1">{ap.description}</p>
                            <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-2">💡 {ap.suggestion}</p>
                          </div>
                          <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-300 px-2 py-1 rounded border border-red-500/30">
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
                  <h3 className="font-semibold text-indigo-600 dark:text-indigo-400 mb-3">💡 Improvement Suggestions:</h3>
                  <div className="space-y-4">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="glass-subtle p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">
                            Line {suggestion.line} • {suggestion.type}
                          </span>
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

              {/* Improvements */}
              {analysis.improvements && analysis.improvements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-heading mb-3">📋 General Improvements:</h3>
                  <div className="space-y-2">
                    {analysis.improvements.map((imp, idx) => (
                      <div key={idx} className="glass-subtle p-3">
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
            </div>
          )}
        </div>
      </div>

      {/* Save to Repository Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setShowSaveDialog(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save to Repository
              </h2>
              <button onClick={() => setShowSaveDialog(false)} className="modal-close">✕</button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSaveToRepository}>
                <div className="input-group">
                  <label className="input-label">Title *</label>
                  <input
                    type="text"
                    value={saveForm.title}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter a title for this code snippet"
                    className="input"
                    required
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Description (Optional)</label>
                  <textarea
                    value={saveForm.description}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Add a description or notes about this code..."
                    className="input"
                    rows={4}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '8px', padding: '12px', marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>
                    <strong>Code Type:</strong> {codeType}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>Lines:</strong> {code.split('\n').length}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={saving || !saveForm.title.trim()}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {saving ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <span className="spinner" style={{ width: '16px', height: '16px' }} />
                        Saving...
                      </span>
                    ) : 'Save to Repository'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveDialog(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
