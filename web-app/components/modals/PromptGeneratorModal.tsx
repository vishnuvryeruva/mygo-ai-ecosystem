'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import RichTextResponse from '../RichTextResponse'
import AppModal from './AppModal'

interface PromptGeneratorModalProps {
  onClose: () => void
  initialPrompt?: string
  initialLanguage?: string
  initialTask?: string
  autoGenerateCode?: boolean
}

type Step = 'describe' | 'refine' | 'code'

export default function PromptGeneratorModal({ onClose, initialPrompt, initialLanguage, initialTask, autoGenerateCode }: PromptGeneratorModalProps) {
  const [language, setLanguage] = useState(initialLanguage || 'ABAP')
  const [taskDescription, setTaskDescription] = useState(initialTask || '')
  // const [context, setContext] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>(initialPrompt ? (autoGenerateCode ? 'code' : 'refine') : 'describe')

  // Conversational refinement state
  const [refinementInput, setRefinementInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>(
    initialPrompt ? [{ role: 'assistant', content: initialPrompt }] : []
  )
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when chat history updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // Code generation state
  const [generatedCode, setGeneratedCode] = useState('')
  const [codeExplanation, setCodeExplanation] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  // GitHub Sync State
  const [ghToken, setGhToken] = useState<string>('')
  const [ghUser, setGhUser] = useState<any>(null)
  const [ghRepos, setGhRepos] = useState<any[]>([])
  const [ghSelectedRepo, setGhSelectedRepo] = useState<string>('')
  const [ghPath, setGhPath] = useState<string>('')
  const [ghIsSyncing, setGhIsSyncing] = useState(false)
  const [ghStatus, setGhStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [showGhLogin, setShowGhLogin] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('gh-token')
    if (savedToken) {
      setGhToken(savedToken)
      fetchGhUser(savedToken)
    }
  }, [])

  useEffect(() => {
    if (ghToken && currentStep === 'code') {
      fetchGhRepos(ghToken)
      // Set default path based on language
      const extMap: Record<string, string> = {
        'ABAP': 'abap', 'ABAP_RAP': 'abap', 'CAP_NODEJS': 'js', 'CAP_JAVA': 'java',
        'Python': 'py', 'JavaScript': 'js', 'Java': 'java', 'TypeScript': 'ts'
      }
      setGhPath(`generated_code.${extMap[language] || 'txt'}`)
    }
  }, [ghToken, currentStep])

  const fetchGhUser = async (token: string) => {
    try {
      const res = await axios.get(`/api/github/user?github_token=${token}`, getAuthConfig())
      setGhUser(res.data.user)
    } catch (err) {
      console.error('Failed to fetch GH user', err)
      setGhToken('')
      localStorage.removeItem('gh-token')
    }
  }

  const fetchGhRepos = async (token: string) => {
    try {
      const res = await axios.get(`/api/github/repos?github_token=${token}`, getAuthConfig())
      setGhRepos(res.data.repos || [])
    } catch (err) {
      console.error('Failed to fetch GH repos', err)
    }
  }

  const handleGhLogin = (token: string) => {
    setGhToken(token)
    localStorage.setItem('gh-token', token)
    fetchGhUser(token)
    setShowGhLogin(false)
  }

  const handleGhPush = async () => {
    if (!ghToken || !ghSelectedRepo || !ghPath || !generatedCode) return
    setGhIsSyncing(true)
    setGhStatus({ text: 'Pushing to GitHub...', type: 'info' })
    try {
      const res = await axios.post('/api/github/push', {
        github_token: ghToken,
        repo: ghSelectedRepo,
        path: ghPath,
        content: generatedCode,
        message: `Sync from MyGO AI - ${taskDescription.slice(0, 50)}...`
      }, getAuthConfig())
      
      if (res.data.status === 'success') {
        setGhStatus({ text: 'Successfully pushed to GitHub!', type: 'success' })
      } else {
        setGhStatus({ text: res.data.message || 'Push failed', type: 'error' })
      }
    } catch (err: any) {
      setGhStatus({ text: err?.response?.data?.message || 'Push failed', type: 'error' })
    } finally {
      setGhIsSyncing(false)
    }
  }

  // Auto-generate code if requested
  useEffect(() => {
    if (autoGenerateCode && initialPrompt && !generatedCode && !loading) {
      handleGenerateCode()
    }
  }, [autoGenerateCode, initialPrompt])

  const getAuthConfig = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mygo-token') : null
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  }

  // ── Step 1: Generate prompt ────────────────
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskDescription.trim()) return

    setLoading(true)
    setChatHistory([])
    setGeneratedCode('')
    setCodeExplanation('')

    try {
      const response = await axios.post('/api/generate-prompt', {
        language,
        task: taskDescription,
        // context
      }, getAuthConfig())
      const generatedPrompt = response.data.prompt
      setPrompt(generatedPrompt)
      // Add initial prompt to chat history
      setChatHistory([{ role: 'assistant', content: generatedPrompt }])
      setCurrentStep('refine')
    } catch (error) {
      console.error('Error generating prompt:', error)
      alert('Error generating prompt. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Refine prompt ──────────────────
  const handleRefinement = async () => {
    if (!refinementInput.trim() || loading) return

    const userRequest = refinementInput.trim()
    setRefinementInput('')
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userRequest }])
    setLoading(true)

    try {
      const response = await axios.post('/api/generate-prompt', {
        language,
        task: `${taskDescription}\n\n[Previous Prompt]:\n${prompt}\n\n[Refinement Request]:\n${userRequest}`,
        // context
      }, getAuthConfig())

      const newPrompt = response.data.prompt
      setPrompt(newPrompt)
      // Add new prompt to chat history
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: newPrompt
      }])
    } catch (error) {
      console.error('Error refining prompt:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Error refining prompt. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Generate code ──────────────────
  const handleGenerateCode = async () => {
    if (!prompt || loading) return
    setLoading(true)
    setCurrentStep('code')

    try {
      const response = await axios.post('/api/generate-code', {
        language,
        prompt,
        // context
      })
      setGeneratedCode(response.data.code || '')
      setCodeExplanation(response.data.explanation || '')
    } catch (error) {
      console.error('Error generating code:', error)
      setGeneratedCode('')
      setCodeExplanation('Error generating code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleReviewWithAdvisor = () => {
    // Map language to code type for Code Advisor
    const languageMap: Record<string, string> = {
      'ABAP': 'ABAP',
      'ABAP_RAP': 'ABAP',
      'CAP_NODEJS': 'JavaScript',
      'CAP_JAVA': 'Java',
      'Python': 'Python',
      'JavaScript': 'JavaScript',
      'Java': 'Java',
      'TypeScript': 'JavaScript',
    }
    
    const codeType = languageMap[language] || 'ABAP'
    
    // Dispatch event to open Code Advisor modal with prepopulated data
    window.dispatchEvent(new CustomEvent('code-advisor-open', {
      detail: { 
        code: generatedCode,
        codeType: codeType
      }
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRefinement()
    }
  }

  const handleStartOver = () => {
    setCurrentStep('describe')
    setPrompt('')
    setChatHistory([])
    setGeneratedCode('')
    setCodeExplanation('')
  }

  // ── Step indicator config ──────────────────
  const steps = [
    { id: 'describe' as Step, label: 'Describe', number: 1 },
    { id: 'refine' as Step, label: 'Refine Prompt', number: 2 },
    { id: 'code' as Step, label: 'Generate Code', number: 3 },
  ]
  const stepOrder: Step[] = ['describe', 'refine', 'code']
  const currentStepIndex = stepOrder.indexOf(currentStep)

  return (
    <AppModal onClose={onClose}>
      <div>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Prompt & Code Studio
            </h2>
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0',
          padding: '16px 24px', borderBottom: '1px solid var(--border-light)',
          background: '#fafbfc'
        }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              }}
                onClick={() => {
                  const targetIdx = stepOrder.indexOf(step.id)
                  if (targetIdx < currentStepIndex) setCurrentStep(step.id)
                }}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: currentStepIndex >= i ? '#ea580c' : '#e2e8f0',
                  color: currentStepIndex >= i ? 'white' : '#94a3b8',
                  transition: 'all 0.2s ease',
                }}>
                  {currentStepIndex > i ? (
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.number}
                </div>
                <span style={{
                  fontSize: '0.8rem', fontWeight: currentStepIndex === i ? 700 : 500,
                  color: currentStepIndex >= i ? 'var(--text-heading)' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: '2px', margin: '0 12px',
                  background: currentStepIndex > i ? '#ea580c' : '#e2e8f0',
                  transition: 'background 0.2s ease',
                }} />
              )}
            </div>
          ))}
        </div>

        <div className="modal-body">
          {/* ── Step 1: Describe ── */}
          {currentStep === 'describe' && (
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

              <button
                type="submit"
                disabled={loading || !taskDescription.trim()}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="spinner" style={{ width: '16px', height: '16px' }} />
                    Generating Prompt...
                  </span>
                ) : 'Generate Prompt →'}
              </button>
            </form>
          )}

          {/* ── Step 2: Refine ── */}
          {currentStep === 'refine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Chat History */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      ...(msg.role === 'user'
                        ? { 
                            padding: '10px 14px', 
                            borderRadius: '12px', 
                            fontSize: '0.85rem',
                            background: '#fff7ed', 
                            border: '1px solid #fed7aa', 
                            color: '#9a3412', 
                            marginLeft: '32px',
                            alignSelf: 'flex-end',
                            maxWidth: '85%'
                          }
                        : { 
                            padding: '16px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            marginRight: '32px',
                            alignSelf: 'flex-start',
                            maxWidth: '85%'
                          }
                        )
                    }}
                  >
                    {msg.role === 'user' ? (
                      <>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>You:</strong>
                        {msg.content}
                      </>
                    ) : (
                      <RichTextResponse
                        content={msg.content}
                        title={index === 0 ? "Generated Prompt" : "Refined Prompt"}
                        showCopy={true}
                        showDownload={false}
                        collapsible={false}
                      />
                    )}
                  </div>
                ))}
                {/* Auto-scroll anchor */}
                <div ref={chatEndRef} />
              </div>

              {/* Refinement suggestions */}
              <div className="glass-subtle" style={{ padding: '16px' }}>
                <h4 style={{ fontWeight: 600, color: '#ea580c', marginBottom: '12px', fontSize: '0.85rem' }}>
                  💡 Refinement Suggestions
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                      style={{
                        padding: '6px 12px', background: '#fff7ed', color: '#9a3412',
                        borderRadius: '20px', fontSize: '0.78rem', border: '1px solid #fed7aa',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#ffedd5' }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#fff7ed' }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Code CTA */}
              <div style={{
                background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
                border: '1px solid #fed7aa',
                borderRadius: '12px', padding: '20px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '16px',
              }}>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#9a3412', margin: '0 0 4px 0', fontSize: '0.9rem' }}>
                    Happy with your prompt?
                  </h4>
                  <p style={{ color: '#c2410c', fontSize: '0.8rem', margin: 0 }}>
                    Generate production-ready {language} code from this prompt
                  </p>
                </div>
                <button
                  onClick={handleGenerateCode}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flexShrink: 0 }}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px' }} />
                      Generating...
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                      Generate Code →
                    </span>
                  )}
                </button>
              </div>

              {/* Start Over */}
              <button
                onClick={handleStartOver}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline',
                  padding: 0,
                }}
              >
                ← Start over with new task
              </button>
            </div>
          )}

          {/* ── Step 3: Generated Code ── */}
          {currentStep === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loading ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '60px 20px', gap: '16px',
                }}>
                  <div className="spinner" style={{ width: '32px', height: '32px', borderColor: '#e2e8f0', borderTopColor: '#ea580c' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
                    Generating {language} code...
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                    This may take a moment for complex code
                  </p>
                </div>
              ) : (
                <>
                  {/* Code Output */}
                  {generatedCode && (
                    <div style={{
                      background: '#1e293b', borderRadius: '12px', overflow: 'hidden',
                      border: '1px solid #334155',
                    }}>
                      {/* Code header */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', background: '#0f172a',
                        borderBottom: '1px solid #334155',
                      }}>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {language}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: codeCopied ? '#16a34a' : '#334155',
                            color: 'white', border: 'none', borderRadius: '6px',
                            padding: '5px 10px', fontSize: '0.72rem', fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s ease',
                          }}
                        >
                          {codeCopied ? (
                            <>
                              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} />
                              </svg>
                              Copy Code
                            </>
                          )}
                        </button>
                      </div>
                      {/* Code body */}
                      <pre style={{
                        padding: '16px', margin: 0, overflow: 'auto',
                        maxHeight: '400px', fontSize: '0.8rem', lineHeight: 1.6,
                        color: '#e2e8f0', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      }}>
                        <code>{generatedCode}</code>
                      </pre>
                    </div>
                  )}

                  {/* Explanation */}
                  {codeExplanation && (
                    <div className="glass-subtle" style={{ padding: '16px' }}>
                      <h4 style={{
                        fontWeight: 600, color: 'var(--text-heading)',
                        marginBottom: '8px', fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                        </svg>
                        Explanation
                      </h4>
                      <RichTextResponse content={codeExplanation} />
                    </div>
                  )}

                  {/* GitHub Sync Section */}
                  {generatedCode && (
                    <div className="glass-subtle" style={{ padding: '16px', marginTop: '16px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                          </svg>
                          Sync to GitHub
                        </h4>
                        {!ghToken ? (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowGhLogin(true)}
                          >
                            Connect GitHub
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Connected as <strong>{ghUser?.login || 'User'}</strong>
                          </span>
                        )}
                      </div>

                      {showGhLogin && (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
                            Enter a GitHub Personal Access Token (PAT) with <code>repo</code> scope.
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="password" 
                              placeholder="ghp_xxxxxxxxxxxx" 
                              className="input" 
                              style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px' }}
                              id="gh-token-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleGhLogin((e.target as HTMLInputElement).value)
                              }}
                            />
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                const val = (document.getElementById('gh-token-input') as HTMLInputElement).value
                                handleGhLogin(val)
                              }}
                            >
                              Connect
                            </button>
                          </div>
                        </div>
                      )}

                      {ghToken && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', display: 'block' }}>REPOSITORY</label>
                              <select 
                                className="input select" 
                                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
                                value={ghSelectedRepo}
                                onChange={(e) => setGhSelectedRepo(e.target.value)}
                              >
                                <option value="">Select a repository...</option>
                                {ghRepos.map(r => (
                                  <option key={r.id} value={r.full_name}>{r.full_name}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', display: 'block' }}>FILE PATH</label>
                              <input 
                                type="text" 
                                className="input" 
                                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
                                value={ghPath}
                                onChange={(e) => setGhPath(e.target.value)}
                                placeholder="path/to/file.abap"
                              />
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {ghStatus && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: ghStatus.type === 'error' ? '#ef4444' : ghStatus.type === 'success' ? '#10b981' : '#3b82f6',
                                fontWeight: 500
                              }}>
                                {ghStatus.text}
                              </span>
                            )}
                            <div style={{ flex: 1 }}></div>
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={handleGhPush}
                              disabled={ghIsSyncing || !ghSelectedRepo || !ghPath}
                              style={{ padding: '6px 16px' }}
                            >
                              {ghIsSyncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {generatedCode && (
                    <div style={{
                      display: 'flex', gap: '12px', flexWrap: 'wrap',
                    }}>
                      <button
                        onClick={handleReviewWithAdvisor}
                        className="btn"
                        style={{
                          background: '#059669', color: 'white',
                          border: '1px solid #059669',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                        </svg>
                        Review with Code Advisor
                      </button>
                      <button
                        onClick={handleGenerateCode}
                        className="btn btn-secondary"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                        </svg>
                        Regenerate
                      </button>
                      <button
                        onClick={() => setCurrentStep('refine')}
                        className="btn btn-secondary"
                      >
                        ← Back to Prompt
                      </button>
                    </div>
                  )}

                  {/* Start Over */}
                  <button
                    onClick={handleStartOver}
                    style={{
                      background: 'none', border: 'none', color: '#94a3b8',
                      cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    ← Start over with new task
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer input (refinement mode only) */}
        {currentStep === 'refine' && (
          <div className="modal-footer">
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <input
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask for improvements or provide additional context..."
                className="input"
                style={{ flex: 1 }}
                disabled={loading}
              />
              <button
                onClick={handleRefinement}
                disabled={loading || !refinementInput.trim()}
                className="btn btn-primary"
              >
                {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : 'Refine'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}
