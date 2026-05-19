'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import AppModal from './AppModal'
import RichTextResponse from '../RichTextResponse'
import { useAutoResize } from '@/hooks/useAutoResize'

interface ExplainCodeModalProps {
  onClose: () => void
  initialCode?: string
  initialCodeType?: string
  initialProgramName?: string
}

export default function ExplainCodeModal({ 
  onClose, 
  initialCode = '', 
  initialCodeType = 'ABAP', 
  initialProgramName = '' 
}: ExplainCodeModalProps) {
  const [code, setCode] = useState(initialCode)
  const [codeType, setCodeType] = useState(initialCodeType)
  const [programName, setProgramName] = useState(initialProgramName)
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const codeRef = useAutoResize(code, 12)
  const [copied, setCopied] = useState(false)

  // Modernisation States
  const [moderniseLanguage, setModerniseLanguage] = useState('ABAP_RAP')
  const [modernisePrompt, setModernisePrompt] = useState('')
  const [moderniseCode, setModerniseCode] = useState('')
  const [moderniseExplanation, setModerniseExplanation] = useState('')
  const [moderniseLoading, setModerniseLoading] = useState(false)
  const [moderniseStep, setModerniseStep] = useState<'none' | 'refine' | 'code'>('none')
  const [moderniseRefinementInput, setModerniseRefinementInput] = useState('')
  const [moderniseChatHistory, setModerniseChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [codeCopied, setCodeCopied] = useState(false)

  const promptRef = useAutoResize(modernisePrompt, 6)

  // GitHub Integration States
  const [ghToken, setGhToken] = useState<string>('')
  const [ghUser, setGhUser] = useState<any>(null)
  const [ghRepos, setGhRepos] = useState<any[]>([])
  const [ghSelectedRepo, setGhSelectedRepo] = useState<string>('')
  const [ghPath, setGhPath] = useState<string>('')
  const [ghIsSyncing, setGhIsSyncing] = useState(false)
  const [ghStatus, setGhStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [showGhLogin, setShowGhLogin] = useState(false)
  const [showGhSection, setShowGhSection] = useState(false)

  const getAuthConfig = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mygo-token') : null
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  }

  // Handle GitHub local storage integration on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('gh-token')
    if (savedToken) {
      setGhToken(savedToken)
      fetchGhUser(savedToken)
    }
  }, [])

  // Auto-fetch repositories when GitHub token is connected and user modernizes code
  useEffect(() => {
    if (ghToken && moderniseStep === 'code') {
      fetchGhRepos(ghToken)
      const extMap: Record<string, string> = {
        'ABAP_RAP': 'abap', 'CAP_NODEJS': 'js', 'CAP_JAVA': 'java'
      }
      setGhPath(`modernised_code.${extMap[moderniseLanguage] || 'txt'}`)
    }
  }, [ghToken, moderniseStep, moderniseLanguage])

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
    if (!ghToken || !ghSelectedRepo || !ghPath || !moderniseCode) return
    setGhIsSyncing(true)
    setGhStatus({ text: 'Pushing to GitHub...', type: 'info' })
    try {
      const res = await axios.post('/api/github/push', {
        github_token: ghToken,
        repo: ghSelectedRepo,
        path: ghPath,
        content: moderniseCode,
        message: `Modernised using MyGO AI - ${explanation.slice(0, 50)}...`
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

  const handleExplain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const activeCode = code.trim() || initialCode.trim()
    const activeProgramName = programName.trim() || initialProgramName.trim()
    
    if (!activeCode && !activeProgramName) return

    setLoading(true)
    try {
      const response = await axios.post('/api/explain-code', {
        code: activeCode,
        code_type: codeType,
        program_name: activeProgramName
      })
      setExplanation(response.data.explanation)
      // Reset modernisation state on new explanation
      setModerniseStep('none')
      setModernisePrompt('')
      setModerniseCode('')
      setModerniseExplanation('')
      setShowGhSection(false)
    } catch (error) {
      console.error('Error explaining code:', error)
      alert('Error explaining code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Automatically trigger code explanation if initialCode is provided
  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      handleExplain()
    }
  }, [initialCode])

  const handleCopyExplanation = () => {
    navigator.clipboard.writeText(explanation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Step 1: Generate optimised prompt from explanation
  const handleStartModernise = async () => {
    if (!explanation) return

    setModerniseLoading(true)
    setModerniseStep('refine')
    setModerniseChatHistory([])
    setModerniseCode('')
    setModerniseExplanation('')
    setShowGhSection(false)

    try {
      const taskText = `Convert the following business logic into a modernized architecture (e.g. RAP or CAP):\n\n${explanation}`
      const response = await axios.post('/api/generate-prompt', {
        language: moderniseLanguage,
        task: taskText
      }, getAuthConfig())

      const generated = response.data.prompt || ''
      setModernisePrompt(generated)
      setModerniseChatHistory([{ role: 'assistant', content: generated }])
    } catch (error) {
      console.error('Error generating prompt config:', error)
      alert('Error generating prompt configuration. Please try again.')
      setModerniseStep('none')
    } finally {
      setModerniseLoading(false)
    }
  }

  // Step 2: Refine the prompt configuration via chatbot style or edit
  const handleRefinePrompt = async () => {
    if (!moderniseRefinementInput.trim() || moderniseLoading) return

    const userText = moderniseRefinementInput.trim()
    setModerniseRefinementInput('')
    setModerniseChatHistory(prev => [...prev, { role: 'user', content: userText }])
    setModerniseLoading(true)

    try {
      const taskText = `Convert the following business logic into a modernized architecture (e.g. RAP or CAP):\n\n${explanation}\n\n[Previous Prompt]:\n${modernisePrompt}\n\n[Refinement Request]:\n${userText}`
      const response = await axios.post('/api/generate-prompt', {
        language: moderniseLanguage,
        task: taskText
      }, getAuthConfig())

      const newPrompt = response.data.prompt || ''
      setModernisePrompt(newPrompt)
      setModerniseChatHistory(prev => [...prev, { role: 'assistant', content: newPrompt }])
    } catch (error) {
      console.error('Error refining prompt configuration:', error)
      setModerniseChatHistory(prev => [...prev, { role: 'assistant', content: 'Failed to refine prompt. Please try again.' }])
    } finally {
      setModerniseLoading(false)
    }
  }

  // Step 3: Call backend api to generate final modernized code from the prompt config
  const handleGenerateModernisedCode = async () => {
    if (!modernisePrompt || moderniseLoading) return

    setModerniseLoading(true)
    setModerniseStep('code')
    setShowGhSection(false)

    try {
      const response = await axios.post('/api/generate-code', {
        language: moderniseLanguage,
        prompt: modernisePrompt
      }, getAuthConfig())

      setModerniseCode(response.data.code || '')
      setModerniseExplanation(response.data.explanation || '')
    } catch (error) {
      console.error('Error generating code:', error)
      setModerniseCode('')
      setModerniseExplanation('Failed to generate modernized code. Please try again.')
    } finally {
      setModerniseLoading(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(moderniseCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleReviewWithCodeAdvisor = () => {
    if (!moderniseCode) return
    window.dispatchEvent(new CustomEvent('code-advisor-open', {
      detail: {
        code: moderniseCode,
        codeType: moderniseLanguage === 'ABAP_RAP' ? 'ABAP' : 'JavaScript'
      }
    }))
  }

  return (
    <AppModal onClose={onClose}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="modal-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="modal-title flex items-center gap-2" style={{ fontWeight: 800, fontSize: '1.25rem' }}>
            <span className="text-2xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(234, 88, 12, 0.25))' }}>💻</span>
            <span style={{ background: 'linear-gradient(135deg, #ea580c, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Explain & Modernise Code
            </span>
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body" style={{ padding: '20px 0' }}>
          {/* Only show the manual code entry form if no initialCode context was supplied */}
          {!initialCode && (
            <form onSubmit={handleExplain} style={{ marginBottom: '24px' }}>
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 700, color: '#334155' }}>Program/Class/Function Name (Optional)</label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g., Z_MY_PROGRAM"
                  className="input"
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 700, color: '#334155' }}>Code Type</label>
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
                <label className="input-label" style={{ fontWeight: 700, color: '#334155' }}>Code</label>
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
                Explain Code
              </button>
            </form>
          )}

          {/* Direct loading animation spinner for BTP object source trigger */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
              <div className="spinner" style={{ width: '36px', height: '36px', borderColor: '#fed7aa', borderTopColor: '#ea580c', borderWidth: '3px' }} />
              <p style={{ color: '#475569', fontSize: '0.95rem', fontWeight: 700 }}>
                Explaining code & analyzing business logic...
              </p>
            </div>
          )}

          {/* Step Indicator */}
          {explanation && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0',
              padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
              background: '#fafbfc', borderRadius: '8px', marginBottom: '20px'
            }}>
              {[
                { id: 'none' as const, label: 'Explain & Analyze', number: 1 },
                { id: 'refine' as const, label: 'Refining Specs', number: 2 },
                { id: 'code' as const, label: 'Modernised Code', number: 3 },
              ].map((step, i, arr) => {
                const stepOrder: ('none' | 'refine' | 'code')[] = ['none', 'refine', 'code']
                const currentStepIndex = stepOrder.indexOf(moderniseStep)
                const isCompleted = currentStepIndex > i
                const isActive = currentStepIndex === i
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : undefined }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', cursor: isCompleted ? 'pointer' : 'default',
                    }}
                      onClick={() => {
                        if (isCompleted) setModerniseStep(step.id)
                      }}
                    >
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: isActive || isCompleted ? '#ea580c' : '#e2e8f0',
                        color: isActive || isCompleted ? 'white' : '#94a3b8',
                        transition: 'all 0.2s ease',
                      }}>
                        {isCompleted ? (
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : step.number}
                      </div>
                      <span style={{
                        fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                        color: isActive || isCompleted ? '#1e293b' : '#94a3b8',
                        whiteSpace: 'nowrap',
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        flex: 1, height: '2px', margin: '0 12px',
                        background: isCompleted ? '#ea580c' : '#e2e8f0',
                        transition: 'background 0.2s ease',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {explanation && !loading && (
            <div>
              {/* Step 1: Explain & Analyze */}
              {moderniseStep === 'none' && (
                <div className="space-y-6">
                  <div className="glass-subtle p-6" style={{
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, #ffffff 100%)',
                    border: '1px solid rgba(253, 186, 116, 0.4)',
                    boxShadow: '0 8px 30px rgba(234, 88, 12, 0.05)',
                    backdropFilter: 'blur(8px)'
                  }}>
                    <div className="flex justify-between items-center mb-4 pb-3" style={{ borderBottom: '1px solid rgba(253, 186, 116, 0.2)' }}>
                      <h3 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ea580c', filter: 'drop-shadow(0 2px 4px rgba(234,88,12,0.2))' }}>📖</span> 
                        Technical Analysis & Explanation
                      </h3>
                      <button
                        type="button"
                        onClick={handleCopyExplanation}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        {copied ? '✓ Copied!' : 'Copy Explanation'}
                      </button>
                    </div>
                    
                    {/* Beautiful Markdown Rendering */}
                    <div style={{ color: '#334155', lineHeight: 1.6 }}>
                      <RichTextResponse content={explanation} />
                    </div>
                  </div>

                  {/* Modernise Business Logic Section */}
                  <div style={{
                    marginTop: '28px',
                    padding: '24px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                    border: '1px solid #fdba74',
                    boxShadow: '0 4px 20px rgba(234, 88, 12, 0.03)'
                  }}>
                    <h4 style={{ fontWeight: 800, color: '#ea580c', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡</span> Modernise Business Logic
                    </h4>
                    <p style={{ color: '#7c2d12', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.5 }}>
                      Automatically convert this legacy business logic into modern, cloud-ready frameworks. Select your target technology to get started.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <select
                          value={moderniseLanguage}
                          onChange={(e) => setModerniseLanguage(e.target.value)}
                          className="input select"
                          style={{ margin: 0, fontWeight: 600, borderColor: '#fdba74', height: '42px', fontSize: '0.85rem' }}
                        >
                          <option value="ABAP_RAP">ABAP RAP (Restful Application Programming)</option>
                          <option value="CAP_NODEJS">CAP (Node.js Microservice)</option>
                          <option value="CAP_JAVA">CAP (Java Enterprise Service)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartModernise}
                        className="btn btn-primary"
                        style={{ whiteSpace: 'nowrap', fontWeight: 700, padding: '10px 24px', background: 'linear-gradient(135deg, #ea580c, #f97316)', height: '42px' }}
                      >
                        Modernise Code →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Refine the generated prompt */}
              {moderniseStep === 'refine' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="flex justify-between items-center mb-1">
                    <h4 style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔧</span> Step 2: Refine Prompt Configuration ({moderniseLanguage})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setModerniseStep('none')}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      ← Back to Analysis
                    </button>
                  </div>

                  {moderniseLoading && !modernisePrompt && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '12px' }}>
                      <div className="spinner" style={{ width: '28px', height: '28px', borderColor: '#fed7aa', borderTopColor: '#ea580c', borderWidth: '3px' }} />
                      <p style={{ color: '#ea580c', fontSize: '0.85rem', fontWeight: 700 }}>Generating optimized prompt configuration...</p>
                    </div>
                  )}

                  {modernisePrompt && (
                    <div className="space-y-6">
                      {/* Chat History / Prompt Spec History */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        padding: '12px',
                        backgroundColor: '#fffbf7',
                        borderRadius: '12px',
                        border: '1px solid #ffe8cc'
                      }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt Generation History</p>
                        
                        {moderniseChatHistory.map((chat, idx) => (
                          <div
                            key={idx}
                            style={{
                              ...(chat.role === 'user'
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
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    marginRight: '32px',
                                    alignSelf: 'flex-start',
                                    maxWidth: '85%'
                                  }
                                )
                            }}
                          >
                            {chat.role === 'user' ? (
                              <>
                                <strong style={{ display: 'block', marginBottom: '4px' }}>You:</strong>
                                {chat.content}
                              </>
                            ) : (
                              <RichTextResponse
                                content={chat.content}
                                title={idx === 0 ? "Generated Specifications" : "Refined Specifications"}
                                showCopy={true}
                                showDownload={false}
                                collapsible={false}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Refinement Suggestions */}
                      <div className="glass-subtle" style={{ padding: '16px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                        <h4 style={{ fontWeight: 700, color: '#ea580c', marginBottom: '12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>💡</span> Modernisation Suggestions
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[
                            'Include comprehensive error handling',
                            'Use modern SAP naming standards',
                            'Add authority checks for security',
                            'Include unit testing specifications',
                            'Separate business logic from endpoints',
                            'Optimize database access patterns'
                          ].map((suggestion, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setModerniseRefinementInput(suggestion)}
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

                      {/* Refinement chat input */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={moderniseRefinementInput}
                          onChange={(e) => setModerniseRefinementInput(e.target.value)}
                          placeholder="e.g., Use UUID for primary key, or include validation checks..."
                          className="input"
                          style={{ margin: 0, borderColor: '#ffe8cc', height: '42px' }}
                          disabled={moderniseLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleRefinePrompt()
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleRefinePrompt}
                          disabled={moderniseLoading || !moderniseRefinementInput.trim()}
                          className="btn btn-secondary"
                          style={{ fontWeight: 700, whiteSpace: 'nowrap', height: '42px', padding: '0 20px' }}
                        >
                          {moderniseLoading ? 'Refining...' : 'Refine'}
                        </button>
                      </div>

                      {/* Happy with prompt? Generate code CTA box */}
                      <div style={{
                        background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
                        border: '1px solid #fed7aa',
                        borderRadius: '16px', 
                        padding: '24px',
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between', 
                        gap: '16px',
                        marginTop: '24px'
                      }}>
                        <div>
                          <h4 style={{ fontWeight: 800, color: '#9a3412', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
                            Ready to modernize?
                          </h4>
                          <p style={{ color: '#c2410c', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                            Generate beautiful, modernized {moderniseLanguage === 'ABAP_RAP' ? 'ABAP RAP' : 'CAP Service'} code from this configuration.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateModernisedCode}
                          disabled={moderniseLoading || !modernisePrompt}
                          className="btn btn-primary"
                          style={{ 
                            flexShrink: 0, 
                            fontWeight: 800, 
                            padding: '12px 24px', 
                            background: 'linear-gradient(135deg, #ea580c, #f97316)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          {moderniseLoading ? (
                            <>
                              <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#ffffff' }} />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              <span>Generate Code →</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Render Modernised Code */}
              {moderniseStep === 'code' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="flex justify-between items-center mb-1">
                    <h4 style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🚀</span> Step 3: Modernised Code Output ({moderniseLanguage})
                    </h4>
                  </div>

                  {moderniseLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '16px' }}>
                      <div className="spinner" style={{ width: '32px', height: '32px', borderColor: '#fed7aa', borderTopColor: '#ea580c', borderWidth: '3px' }} />
                      <p style={{ color: '#ea580c', fontSize: '0.9rem', fontWeight: 700 }}>Fulfilling requirements & designing modernized code structure...</p>
                      <p style={{ color: '#64748b', fontSize: '0.78rem' }}>Please hold on while we build the clean, modularized architecture.</p>
                    </div>
                  )}

                  {!moderniseLoading && moderniseCode && (
                    <div className="space-y-6">
                      {/* Code Container */}
                      <div style={{ position: 'relative', border: '1px solid #ffd8a8', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(234, 88, 12, 0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7ed', padding: '10px 18px', borderBottom: '1px solid #ffd8a8' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {moderniseLanguage} Output
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, margin: 0 }}
                          >
                            {codeCopied ? '✓ Copied!' : 'Copy Code'}
                          </button>
                        </div>
                        <pre style={{ margin: 0, padding: '20px', backgroundColor: '#0f172a', color: '#f8fafc', overflowX: 'auto', fontSize: '0.82rem', lineHeight: 1.6, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", maxHeight: '350px' }}>
                          <code>{moderniseCode}</code>
                        </pre>
                      </div>

                      {/* Architecture & Integration Explanation */}
                      {moderniseExplanation && (
                        <div className="glass-subtle" style={{ border: '1px solid #ffe8cc', borderRadius: '12px', padding: '20px', background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, #ffffff 100%)' }}>
                          <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ea580c', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>💡</span> Technical Architecture & Integration Steps
                          </h5>
                          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
                            <RichTextResponse content={moderniseExplanation} />
                          </div>
                        </div>
                      )}

                      {/* Action Buttons Row */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #fdba74' }}>
                        <button
                          type="button"
                          onClick={() => setModerniseStep('refine')}
                          className="btn btn-secondary"
                          style={{ flex: 1, minWidth: '130px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          ← Back to Specs
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateModernisedCode}
                          className="btn btn-secondary"
                          style={{ flex: 1, minWidth: '130px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M23 4v6h-6M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                          </svg>
                          Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={handleReviewWithCodeAdvisor}
                          className="btn btn-primary"
                          style={{ flex: 1.5, minWidth: '180px', fontWeight: 800, background: 'linear-gradient(135deg, #ea580c, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M9 12l2 2 4-4" />
                          </svg>
                          Review in Advisor
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGhSection(!showGhSection)}
                          className="btn btn-secondary"
                          style={{ flex: 1, minWidth: '145px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                          </svg>
                          Sync GitHub
                        </button>
                      </div>

                      {/* GitHub Sync Panel Section */}
                      {showGhSection && (
                        <div className="glass-subtle" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #ffd8a8', backgroundColor: '#fffaf5', marginTop: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <h4 style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ea580c', margin: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                              </svg>
                              Sync to GitHub Repository
                            </h4>
                            {!ghToken ? (
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowGhLogin(true)}
                                style={{ fontWeight: 700 }}
                              >
                                Connect GitHub Account
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                                Connected as <strong style={{ color: '#ea580c' }}>{ghUser?.login || 'User'}</strong>
                              </span>
                            )}
                          </div>

                          {showGhLogin && (
                            <div style={{ marginBottom: '16px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #ffe8cc' }}>
                              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px', lineHeight: 1.4 }}>
                                Enter a GitHub Personal Access Token (PAT) with <code>repo</code> scope to sync.
                              </p>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="password" 
                                  placeholder="ghp_xxxxxxxxxxxx" 
                                  className="input" 
                                  style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px', margin: 0 }}
                                  id="gh-token-input-modal"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleGhLogin((e.target as HTMLInputElement).value)
                                  }}
                                />
                                <button 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    const val = (document.getElementById('gh-token-input-modal') as HTMLInputElement).value
                                    handleGhLogin(val)
                                  }}
                                  style={{ fontWeight: 700 }}
                                >
                                  Connect
                                </button>
                              </div>
                            </div>
                          )}

                          {ghToken && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ea580c', marginBottom: '4px', display: 'block' }}>REPOSITORY</label>
                                  <select 
                                    className="input select" 
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px', margin: 0 }}
                                    value={ghSelectedRepo}
                                    onChange={(e) => setGhSelectedRepo(e.target.value)}
                                  >
                                    <option value="">Select a repository...</option>
                                    {ghRepos.map(r => (
                                      <option key={r.id} value={r.full_name}>{r.full_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ea580c', marginBottom: '4px', display: 'block' }}>FILE PATH</label>
                                  <input 
                                    type="text" 
                                    className="input" 
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px', margin: 0 }}
                                    value={ghPath}
                                    onChange={(e) => setGhPath(e.target.value)}
                                    placeholder="path/to/file.abap"
                                  />
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                  {ghStatus && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700,
                                      color: ghStatus.type === 'error' ? '#ef4444' : ghStatus.type === 'success' ? '#10b981' : '#3b82f6',
                                    }}>
                                      {ghStatus.text}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleGhPush}
                                  disabled={ghIsSyncing || !ghSelectedRepo || !ghPath}
                                  className="btn btn-primary"
                                  style={{ padding: '8px 16px', fontWeight: 800, background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}
                                >
                                  {ghIsSyncing ? 'Syncing...' : 'Push to GitHub'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  )
}
