'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface CodeSnippet {
  id: string
  title: string
  code: string
  code_type: string
  description?: string
  analysis_data?: any
  created_at: string
  updated_at: string
}

export default function CodeRepositoryPage() {
  const [snippets, setSnippets] = useState<CodeSnippet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    fetchSnippets()
  }, [])

  const fetchSnippets = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('mygo-token')
      const response = await axios.get('/api/code-repository', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      setSnippets(response.data.snippets || [])
    } catch (error) {
      console.error('Error fetching code snippets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (snippetId: string) => {
    if (!confirm('Are you sure you want to delete this code snippet?')) return

    try {
      const token = localStorage.getItem('mygo-token')
      await axios.delete(`/api/code-repository/${snippetId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      setSnippets(prev => prev.filter(s => s.id !== snippetId))
      if (selectedSnippet?.id === snippetId) {
        setSelectedSnippet(null)
      }
    } catch (error) {
      console.error('Error deleting snippet:', error)
      alert('Error deleting snippet. Please try again.')
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const filteredSnippets = snippets.filter(snippet => {
    const matchesSearch = snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (snippet.description && snippet.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = filterType === 'all' || snippet.code_type === filterType
    return matchesSearch && matchesType
  })

  const codeTypes = Array.from(new Set(snippets.map(s => s.code_type)))

  return (
    <div className="page-content-area">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-main-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Code Repository
        </h1>
        <p className="page-main-subtitle">Your saved code snippets and analyzed code</p>
      </div>

      {loading ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 20px', gap: '16px'
        }}>
          <div className="spinner" style={{ width: '32px', height: '32px' }} />
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading code snippets...</p>
        </div>
      ) : snippets.length === 0 ? (
        <div className="placeholder-card">
          <div className="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <h3>No Code Snippets Yet</h3>
          <p>Code snippets you save from the Code Advisor will appear here.</p>
        </div>
      ) : (
        <>
          {/* Search and Filter Bar */}
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '24px',
            flexWrap: 'wrap', alignItems: 'center'
          }}>
            <div style={{
              flex: '1 1 300px', position: 'relative',
              display: 'flex', alignItems: 'center'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '12px' }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ paddingLeft: '40px', width: '100%' }}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input select"
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Types</option>
              {codeTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
              {filteredSnippets.length} snippet{filteredSnippets.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Two-column layout: List + Detail */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedSnippet ? '400px 1fr' : '1fr',
            gap: '20px',
            height: 'calc(100vh - 280px)'
          }}>
            {/* Snippets List */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '12px',
              overflowY: 'auto', paddingRight: '8px'
            }}>
              {filteredSnippets.map(snippet => (
                <div
                  key={snippet.id}
                  onClick={() => setSelectedSnippet(snippet)}
                  className="glass-subtle"
                  style={{
                    padding: '16px', borderRadius: '12px', cursor: 'pointer',
                    border: selectedSnippet?.id === snippet.id ? '2px solid #059669' : '1px solid var(--border-light)',
                    transition: 'all 0.2s ease',
                    background: selectedSnippet?.id === snippet.id ? '#ecfdf5' : undefined
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <h3 style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.95rem', margin: 0 }}>
                      {snippet.title}
                    </h3>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, color: '#059669',
                      background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px',
                      border: '1px solid #a7f3d0'
                    }}>
                      {snippet.code_type}
                    </span>
                  </div>
                  {snippet.description && (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                      {snippet.description.length > 100 ? snippet.description.substring(0, 100) + '...' : snippet.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>{new Date(snippet.created_at).toLocaleDateString()}</span>
                    <span>{snippet.code.split('\n').length} lines</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail View */}
            {selectedSnippet && (
              <div className="glass-subtle" style={{
                padding: '24px', borderRadius: '12px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: '16px'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h2 style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '1.2rem', margin: '0 0 8px 0' }}>
                      {selectedSnippet.title}
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600, color: '#059669',
                        background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid #a7f3d0'
                      }}>
                        {selectedSnippet.code_type}
                      </span>
                      <span>Created: {new Date(selectedSnippet.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSnippet(null)}
                    style={{
                      background: 'none', border: 'none', fontSize: '1.5rem',
                      color: '#94a3b8', cursor: 'pointer', padding: '4px 8px'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Description */}
                {selectedSnippet.description && (
                  <div>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.85rem', marginBottom: '8px' }}>
                      Description
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                      {selectedSnippet.description}
                    </p>
                  </div>
                )}

                {/* Code */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.85rem', margin: 0 }}>
                      Code
                    </h4>
                    <button
                      onClick={() => handleCopyCode(selectedSnippet.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: '#334155', color: 'white', border: 'none',
                        borderRadius: '6px', padding: '5px 10px', fontSize: '0.72rem',
                        fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <pre style={{
                    background: '#1e293b', color: '#e2e8f0', padding: '16px',
                    borderRadius: '8px', overflow: 'auto', maxHeight: '400px',
                    fontSize: '0.8rem', lineHeight: 1.6,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    border: '1px solid #334155'
                  }}>
                    <code>{selectedSnippet.code}</code>
                  </pre>
                </div>

                {/* Analysis Results */}
                {selectedSnippet.analysis_data && (
                  <div>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.85rem', marginBottom: '12px' }}>
                      Analysis Results
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedSnippet.analysis_data.anti_patterns && selectedSnippet.analysis_data.anti_patterns.length > 0 && (
                        <div style={{
                          background: '#fef2f2', border: '1px solid #fecaca',
                          borderRadius: '8px', padding: '12px'
                        }}>
                          <p style={{ fontWeight: 600, color: '#dc2626', fontSize: '0.8rem', margin: '0 0 8px 0' }}>
                            ⚠️ {selectedSnippet.analysis_data.anti_patterns.length} Anti-pattern(s) Found
                          </p>
                        </div>
                      )}
                      {selectedSnippet.analysis_data.suggestions && selectedSnippet.analysis_data.suggestions.length > 0 && (
                        <div style={{
                          background: '#eff6ff', border: '1px solid #bfdbfe',
                          borderRadius: '8px', padding: '12px'
                        }}>
                          <p style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.8rem', margin: '0 0 8px 0' }}>
                            💡 {selectedSnippet.analysis_data.suggestions.length} Improvement Suggestion(s)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => handleDelete(selectedSnippet.id)}
                    className="btn btn-secondary"
                    style={{
                      background: '#fee2e2', color: '#dc2626',
                      border: '1px solid #fecaca'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
