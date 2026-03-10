'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import RichTextResponse from '../RichTextResponse'

interface TestCaseGeneratorModalProps {
  onClose: () => void
}

interface Source { id: string; name: string; type: string }
interface Project { id: string; name: string }
interface Scope { id: string; name: string; projectId?: string }

interface TestAction {
  title: string
  description: string
  expectedResult: string
  sequence: number
  isEvidenceRequired: boolean
}

interface TestActivity {
  title: string
  sequence: number
  isInScope: boolean
  toActions: TestAction[]
}

interface TestCase {
  title: string
  toActivities: TestActivity[]
}

type AlmUploadStep = 'idle' | 'form' | 'uploading' | 'success' | 'error'

export default function TestCaseGeneratorModal({ onClose }: TestCaseGeneratorModalProps) {
  const [code, setCode] = useState('')
  const [testType, setTestType] = useState('manual')
  const [loading, setLoading] = useState(false)
  const [testCases, setTestCases] = useState('')
  const [testCasesStructured, setTestCasesStructured] = useState<TestCase[]>([])
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Cloud ALM upload state
  const [almUploadStep, setAlmUploadStep] = useState<AlmUploadStep>('idle')
  const [almSources, setAlmSources] = useState<Source[]>([])
  const [almSelectedSource, setAlmSelectedSource] = useState('')
  const [almProjects, setAlmProjects] = useState<Project[]>([])
  const [almSelectedProject, setAlmSelectedProject] = useState('')
  const [almScopes, setAlmScopes] = useState<Scope[]>([])
  const [almSelectedScope, setAlmSelectedScope] = useState('')
  const [almPriorityCode, setAlmPriorityCode] = useState(20)
  const [almNamePrefix, setAlmNamePrefix] = useState('')
  const [almLoadingStep, setAlmLoadingStep] = useState('')
  const [almError, setAlmError] = useState('')
  const [almSuccessDoc, setAlmSuccessDoc] = useState<any>(null)

  const handleOpenAlmUpload = async () => {
    setAlmUploadStep('form')
    setAlmError('')
    setAlmNamePrefix(`Test Cases - ${new Date().toLocaleDateString()}`)
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
    setAlmScopes([])
    setAlmSelectedScope('')
    try {
      const res = await axios.get(`/api/calm/${sourceId}/projects`)
      setAlmProjects(res.data.projects || [])
    } catch {
      setAlmError('Failed to load projects.')
    } finally {
      setAlmLoadingStep('')
    }
  }

  const loadAlmScopes = async (sourceId: string, projectId: string) => {
    setAlmLoadingStep('scopes')
    setAlmScopes([])
    setAlmSelectedScope('')
    try {
      const res = await axios.get(`/api/calm/${sourceId}/scopes?projectId=${projectId}`)
      const allScopes = res.data.scopes || []
      // Filter scopes to only show those belonging to the selected project
      const filteredScopes = allScopes.filter((scope: Scope & { projectId?: string }) => 
        scope.projectId === projectId
      )
      setAlmScopes(filteredScopes)
    } catch {
      setAlmError('Failed to load scopes.')
    } finally {
      setAlmLoadingStep('')
    }
  }

  const handleAlmUpload = async () => {
    if (!almSelectedSource || !almSelectedProject || !almSelectedScope) return
    if (!testCasesStructured || testCasesStructured.length === 0) {
      setAlmError('No test cases available to upload. Please generate test cases first.')
      return
    }
    
    setAlmUploadStep('uploading')
    setAlmError('')
    try {
      const res = await axios.post(`/api/calm/${almSelectedSource}/push-test-cases`, {
        testCases: testCasesStructured,
        projectId: almSelectedProject,
        scopeId: almSelectedScope,
        priorityCode: almPriorityCode,
        namePrefix: almNamePrefix.trim()
      })
      setAlmSuccessDoc(res.data)
      setAlmUploadStep('success')
    } catch (err: any) {
      console.error('Upload error:', err)
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
    setAlmScopes([])
    setAlmSelectedScope('')
    setAlmPriorityCode(20)
    setAlmNamePrefix('')
    setAlmError('')
    setAlmSuccessDoc(null)
    setAlmLoadingStep('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setTestCases('')
    setTestCasesStructured([])

    try {
      // Generate both preview format (for display) and CALM format (for upload)
      const [previewResponse, calmResponse] = await Promise.all([
        axios.post('/api/generate-test-cases', {
          code,
          test_type: testType,
          format: 'preview'
        }),
        axios.post('/api/generate-test-cases', {
          code,
          test_type: testType,
          format: 'calm'
        })
      ])
      
      setTestCases(previewResponse.data.test_cases || previewResponse.data.testCases || previewResponse.data)
      setTestCasesStructured(calmResponse.data.test_cases || [])
    } catch (error) {
      console.error('Error generating test cases:', error)
      alert('Error generating test cases. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format: 'docx' | 'pdf' | 'excel') => {
    if (!testCases) return

    const backendFormat = format === 'docx' ? 'word' : format

    setDownloadLoading(true)
    try {
      const response = await axios.post('/api/generate-test-cases', {
        code,
        test_type: testType,
        format: backendFormat
      }, {
        responseType: 'blob'
      })

      let mimeType: string
      let extension: string

      if (format === 'excel') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'xlsx'
      } else {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
      }

      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test_cases.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading test cases:', error)
      alert('Error downloading test cases. Please try again.')
    } finally {
      setDownloadLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-5xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            Test Case Generator
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleGenerate}>
            <div className="input-group">
              <label className="input-label">Test Type</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="input select"
              >
                <option value="manual">Manual Test Cases</option>
                <option value="unit">ABAP Unit Test Skeletons</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the code you want to generate test cases for..."
                className="input font-mono text-sm"
                rows={8}
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
                  Generating...
                </span>
              ) : 'Generate Test Cases'}
            </button>
          </form>

          {testCases && (
            <div className="mt-6">
              {downloadLoading && (
                <div className="mb-4 flex items-center justify-center text-muted">
                  <span className="spinner w-4 h-4 mr-2" />
                  Preparing download...
                </div>
              )}

              {/* Download Format Buttons */}
              <div className="mb-4 flex gap-2 justify-end">
                <button
                  onClick={() => handleDownload('docx')}
                  disabled={downloadLoading}
                  className="btn btn-secondary text-sm"
                >
                  📄 Word
                </button>
                <button
                  onClick={() => handleDownload('excel')}
                  disabled={downloadLoading}
                  className="btn btn-success text-sm"
                >
                  📊 Excel
                </button>
              </div>

              <div className="glass-subtle p-4 mb-4">
                <RichTextResponse
                  content={testCases}
                  title="Generated Test Cases"
                  showCopy={true}
                  showDownload={false}
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
                <div className="glass-subtle rounded-xl border border-emerald-500/20 overflow-hidden mt-4">
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
                        {almSuccessDoc?.message && (
                          <p className="text-muted text-sm">{almSuccessDoc.message}</p>
                        )}
                        {almSuccessDoc?.testCases && almSuccessDoc.testCases.length > 0 && (
                          <div className="mt-2 text-left w-full max-h-40 overflow-y-auto">
                            <p className="text-xs text-muted mb-2">Created test cases:</p>
                            <ul className="text-xs space-y-1">
                              {almSuccessDoc.testCases.map((tc: any, idx: number) => (
                                <li key={idx} className="text-emerald-300">✓ {tc.title}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {almSuccessDoc?.errors && almSuccessDoc.errors.length > 0 && (
                          <div className="mt-2 text-left w-full max-h-40 overflow-y-auto">
                            <p className="text-xs text-red-400 mb-2">Errors:</p>
                            <ul className="text-xs space-y-1">
                              {almSuccessDoc.errors.map((err: string, idx: number) => (
                                <li key={idx} className="text-red-300">✗ {err}</li>
                              ))}
                            </ul>
                          </div>
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

                        <div className="input-group mb-0">
                          <label className="input-label text-xs">Test Case Name Prefix (Optional)</label>
                          <input
                            type="text"
                            value={almNamePrefix}
                            onChange={e => setAlmNamePrefix(e.target.value)}
                            className="input text-sm"
                            placeholder="e.g., Sprint 1 - Login Module"
                          />
                          <p className="text-xs text-muted mt-1">
                            This prefix will be added to all test case titles
                          </p>
                        </div>

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

                        {almSelectedSource && (
                          <div className="input-group mb-0">
                            <label className="input-label text-xs">
                              Project
                              {almLoadingStep === 'projects' && <span className="ml-2 text-muted">(loading...)</span>}
                            </label>
                            <select
                              value={almSelectedProject}
                              onChange={e => {
                                setAlmSelectedProject(e.target.value)
                                if (e.target.value) loadAlmScopes(almSelectedSource, e.target.value)
                              }}
                              className="input select text-sm"
                              disabled={almLoadingStep === 'projects' || almProjects.length === 0}
                            >
                              <option value="">Select project...</option>
                              {almProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                        )}

                        {almSelectedProject && (
                          <div className="input-group mb-0">
                            <label className="input-label text-xs">
                              Scope
                              {almLoadingStep === 'scopes' && <span className="ml-2 text-muted">(loading...)</span>}
                            </label>
                            <select
                              value={almSelectedScope}
                              onChange={e => setAlmSelectedScope(e.target.value)}
                              className="input select text-sm"
                              disabled={almLoadingStep === 'scopes' || almScopes.length === 0}
                            >
                              <option value="">Select scope...</option>
                              {almScopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}

                        {almSelectedScope && (
                          <div className="input-group mb-0">
                            <label className="input-label text-xs">Priority</label>
                            <select
                              value={almPriorityCode}
                              onChange={e => setAlmPriorityCode(Number(e.target.value))}
                              className="input select text-sm"
                            >
                              <option value={10}>Low</option>
                              <option value={20}>Medium</option>
                              <option value={30}>High</option>
                            </select>
                          </div>
                        )}

                        <button
                          onClick={handleAlmUpload}
                          disabled={!almSelectedProject || !almSelectedScope || !!almLoadingStep}
                          className="w-full btn btn-primary text-sm mt-1"
                        >
                          Upload as Manual Test Cases
                        </button>
                      </>
                    )}
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
