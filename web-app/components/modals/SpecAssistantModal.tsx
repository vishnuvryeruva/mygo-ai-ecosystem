'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'

interface SpecAssistantModalProps {
  onClose: () => void
}

interface Source { id: string; name: string; type: string }
interface Project { id: string; name: string }

type AlmUploadStep = 'idle' | 'form' | 'uploading' | 'success' | 'error'

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

  // Cloud ALM upload state
  const [almUploadStep, setAlmUploadStep] = useState<AlmUploadStep>('idle')
  const [almSources, setAlmSources] = useState<Source[]>([])
  const [almSelectedSource, setAlmSelectedSource] = useState('')
  const [almProjects, setAlmProjects] = useState<Project[]>([])
  const [almSelectedProject, setAlmSelectedProject] = useState('')
  const [almDocName, setAlmDocName] = useState('')
  const [almLoadingStep, setAlmLoadingStep] = useState('')
  const [almError, setAlmError] = useState('')
  const [almSuccessDoc, setAlmSuccessDoc] = useState<any>(null)

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

  const handleOpenAlmUpload = async () => {
    setAlmUploadStep('form')
    setAlmError('')
    setAlmDocName(`${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`)
    setAlmLoadingStep('sources')
    try {
      const res = await axios.get('/api/sources')
      const calmSources = (res.data.sources || []).filter((s: Source) => s.type === 'CALM')
      setAlmSources(calmSources)
      if (calmSources.length === 1) {
        setAlmSelectedSource(calmSources[0].id)
        await loadAlmProjects(calmSources[0].id)
      }
    } catch {
      setAlmError('Failed to load Cloud ALM sources.')
    } finally {
      setAlmLoadingStep('')
    }
  }

  const loadAlmProjects = async (sourceId: string) => {
    setAlmLoadingStep('projects')
    setAlmProjects([])
    setAlmSelectedProject('')
    try {
      const res = await axios.get(`/api/calm/${sourceId}/projects`)
      setAlmProjects(res.data.projects || [])
    } catch {
      setAlmError('Failed to load projects.')
    } finally {
      setAlmLoadingStep('')
    }
  }

  const handleAlmUpload = async () => {
    if (!almSelectedSource || !almSelectedProject || !almDocName.trim()) return
    setAlmUploadStep('uploading')
    setAlmError('')
    try {
      const res = await axios.post(`/api/calm/${almSelectedSource}/push-spec`, {
        name: almDocName.trim(),
        content: specContent,
        projectId: almSelectedProject,
        documentType: specType === 'functional' ? 'functional_spec' : 'technical_spec'
      })
      setAlmSuccessDoc(res.data.document)
      setAlmUploadStep('success')
    } catch (err: any) {
      setAlmError(err?.response?.data?.error || 'Failed to upload to Cloud ALM.')
      setAlmUploadStep('error')
    }
  }

  const resetAlmUpload = () => {
    setAlmUploadStep('idle')
    setAlmSources([])
    setAlmSelectedSource('')
    setAlmProjects([])
    setAlmSelectedProject('')
    setAlmDocName('')
    setAlmError('')
    setAlmSuccessDoc(null)
    setAlmLoadingStep('')
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
              <p className="text-sm text-muted mt-1">Conversational mode - refine your specification</p>
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
                        : 'glass-subtle text-muted mr-8'
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

              {/* Upload to Cloud ALM */}
              {almUploadStep === 'idle' && (
                <button
                  onClick={handleOpenAlmUpload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload to Cloud ALM
                </button>
              )}

              {/* ALM Upload Panel */}
              {almUploadStep !== 'idle' && (
                <div className="glass-subtle rounded-xl border border-emerald-500/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <h4 className="font-medium text-emerald-300 flex items-center gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload to Cloud ALM
                    </h4>
                    <button onClick={resetAlmUpload} className="text-muted hover:text-main text-lg leading-none">✕</button>
                  </div>

                  <div className="p-4 space-y-3">
                    {almUploadStep === 'uploading' && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3 text-muted">
                        <div className="spinner w-6 h-6" />
                        <span className="text-sm">Uploading to Cloud ALM...</span>
                      </div>
                    )}

                    {almUploadStep === 'success' && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">✓</div>
                        <p className="text-emerald-300 font-medium">Uploaded successfully!</p>
                        {almSuccessDoc?.name && (
                          <p className="text-muted text-sm">"{almSuccessDoc.name}" has been added to Cloud ALM.</p>
                        )}
                        <button onClick={resetAlmUpload} className="mt-2 text-sm text-muted hover:text-main underline">Done</button>
                      </div>
                    )}

                    {almUploadStep === 'error' && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                          {almError}
                        </div>
                        <button
                          onClick={() => setAlmUploadStep('form')}
                          className="text-sm text-muted hover:text-main underline"
                        >
                          ← Try again
                        </button>
                      </div>
                    )}

                    {almUploadStep === 'form' && (
                      <>
                        {almError && (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                            {almError}
                          </div>
                        )}

                        {/* Document Name */}
                        <div className="input-group mb-0">
                          <label className="input-label text-xs">Document Name</label>
                          <input
                            type="text"
                            value={almDocName}
                            onChange={e => setAlmDocName(e.target.value)}
                            className="input text-sm"
                            placeholder="Enter document name..."
                          />
                        </div>

                        {/* Source */}
                        {almSources.length > 1 && (
                          <div className="input-group mb-0">
                            <label className="input-label text-xs">Cloud ALM Source</label>
                            <select
                              value={almSelectedSource}
                              onChange={e => {
                                setAlmSelectedSource(e.target.value)
                                if (e.target.value) loadAlmProjects(e.target.value)
                              }}
                              className="input select text-sm"
                              disabled={almLoadingStep === 'projects'}
                            >
                              <option value="">Select source...</option>
                              {almSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}

                        {almSources.length === 0 && almLoadingStep !== 'sources' && (
                          <p className="text-sm text-red-400">No Cloud ALM sources configured. Please add one in Sources.</p>
                        )}

                        {/* Project */}
                        {almSelectedSource && (
                          <div className="input-group mb-0">
                            <label className="input-label text-xs">
                              Project
                              {almLoadingStep === 'projects' && <span className="ml-2 text-muted">(loading...)</span>}
                            </label>
                            <select
                              value={almSelectedProject}
                              onChange={e => setAlmSelectedProject(e.target.value)}
                              className="input select text-sm"
                              disabled={almLoadingStep === 'projects' || almProjects.length === 0}
                            >
                              <option value="">Select project...</option>
                              {almProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                        )}

                        <button
                          onClick={handleAlmUpload}
                          disabled={!almSelectedProject || !almDocName.trim() || !!almLoadingStep}
                          className="w-full btn btn-primary text-sm mt-1"
                        >
                          Upload to Cloud ALM
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

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
                className="text-muted hover:text-main text-sm underline"
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
