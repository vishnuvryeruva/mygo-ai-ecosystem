'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'
import ScrollToLatestButton from '../ScrollToLatestButton'
import AppModal from './AppModal'
import DocumentDestinationUpload from '../DocumentDestinationUpload'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useScrollToLatest } from '@/hooks/useScrollToLatest'

interface SpecAssistantModalProps {
  onClose: () => void
  initialRequirements?: string
}

export default function SpecAssistantModal({ onClose, initialRequirements }: SpecAssistantModalProps) {
  const [requirements, setRequirements] = useState('')
  const [specType, setSpecType] = useState('functional')
  const [loading, setLoading] = useState(false)
  const requirementsRef = useAutoResize(requirements, 6)
  const [specContent, setSpecContent] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Conversational refinement state
  const [refinementMode, setRefinementMode] = useState(false)
  const [refinementInput, setRefinementInput] = useState('')
  const [refinementHistory, setRefinementHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([])

  const {
    containerRef: refinementContainerRef,
    showScrollToLatest,
    handleScroll: handleRefinementScroll,
    scrollToBottom,
  } = useScrollToLatest([refinementHistory, loading], {
    itemCount: refinementHistory.length,
    enabled: refinementMode,
  })

  useEffect(() => {
    if (initialRequirements?.trim()) {
      setRequirements(initialRequirements)
    }
  }, [initialRequirements])

  // Check for context and prefilled spec from Solution Advisor (Create Functional Spec flow)
  useEffect(() => {
    const context = sessionStorage.getItem('solutionAdvisorContext')
    const prefilledSpec = sessionStorage.getItem('specAssistantPrefilledSpec')

    if (prefilledSpec) {
      setSpecContent(prefilledSpec)
      setRefinementMode(true)
      sessionStorage.removeItem('specAssistantPrefilledSpec')
      return
    }

    if (!context) return

    setLoading(true)
    setSpecContent('')
    setRefinementMode(false)
    setRefinementHistory([])

    let cancelled = false
    ;(async () => {
      try {
        const response = await axios.post('/api/generate-spec', {
          type: 'functional',
          requirements: context,
          format: 'preview'
        })
        if (!cancelled) {
          setSpecContent(response.data?.spec ?? '')
          setRefinementMode(true)
          sessionStorage.removeItem('solutionAdvisorContext')
          sessionStorage.removeItem('specAssistantAutoGenerate')
        }
      } catch (error) {
        console.error('Error generating specification:', error)
        if (!cancelled) {
          alert('Error generating specification. You can edit requirements and click Generate Specification.')
          sessionStorage.removeItem('solutionAdvisorContext')
          sessionStorage.removeItem('specAssistantAutoGenerate')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      setLoading(false)
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

  const handleDownloadPdf = () => {
    if (!specContent) return

    setDownloadLoading(true)

    const title = `${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`

    // Convert markdown-like content to basic HTML for print
    const htmlContent = specContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\n\n')
      .map(para => {
        const lines = para.split('\n')
        if (lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('• ') || l.trim() === '')) {
          const items = lines.filter(l => l.trim()).map(l => `<li>${l.replace(/^[\s]*[-•]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`).join('')
          return `<ul>${items}</ul>`
        }
        if (lines.every(l => /^\d+\./.test(l.trim()) || l.trim() === '')) {
          const items = lines.filter(l => l.trim()).map(l => `<li>${l.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`).join('')
          return `<ol>${items}</ol>`
        }
        if (para.trim().startsWith('```')) {
          const code = para.replace(/```\w*\n?/, '').replace(/```$/, '')
          return `<pre><code>${code}</code></pre>`
        }
        const text = lines
          .map(l => l.replace(/^(#{1,4})\s+(.*)/, (_, hashes, content) => {
            const level = Math.min(hashes.length, 4)
            return `<h${level}>${content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</h${level}>`
          }))
          .map(l => l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'))
          .join('<br/>')
        return `<p>${text}</p>`
      })
      .join('\n')

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow pop-ups to download the PDF.')
      setDownloadLoading(false)
      return
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #1a1a2e;
      padding: 40px 50px;
      max-width: 860px;
      margin: 0 auto;
    }
    .doc-header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }
    .doc-title {
      font-size: 22pt;
      font-weight: 700;
      color: #4f46e5;
    }
    .doc-meta {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 6px;
    }
    h1 { font-size: 16pt; color: #1e1b4b; margin: 22px 0 8px; border-bottom: 1px solid #e0e0f0; padding-bottom: 4px; }
    h2 { font-size: 14pt; color: #312e81; margin: 18px 0 6px; }
    h3 { font-size: 12pt; color: #4338ca; margin: 14px 0 4px; }
    h4 { font-size: 11pt; color: #4f46e5; margin: 10px 0 4px; }
    p  { margin: 6px 0; }
    ul, ol { margin: 6px 0 6px 24px; }
    li { margin-bottom: 3px; }
    pre {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 9.5pt;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 10px 0;
    }
    strong { font-weight: 600; }
    @media print {
      body { padding: 20px 30px; }
      .doc-header { break-after: avoid; }
      h1, h2, h3 { break-after: avoid; }
      pre { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-title">${title}</div>
    <div class="doc-meta">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
  ${htmlContent}
</body>
</html>`)

    printWindow.document.close()
    printWindow.focus()

    // Give browser time to render before triggering print
    setTimeout(() => {
      printWindow.print()
      setDownloadLoading(false)
    }, 500)
  }

  const handleDownload = async (format: 'docx' | 'pdf' | 'excel') => {
    if (format === 'pdf') {
      handleDownloadPdf()
      return
    }

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

      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${specType}_specification.docx`
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

  return (
    <AppModal onClose={onClose}>
      <div>
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
                  ref={requirementsRef}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Describe the requirements for the specification..."
                  className="input"
                  style={{ resize: 'none' }}
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
                <div className="scroll-to-latest-wrap mb-4">
                  <div
                    ref={refinementContainerRef}
                    className="space-y-2"
                    style={{ maxHeight: '280px', overflowY: 'auto' }}
                    onScroll={handleRefinementScroll}
                  >
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
                  <ScrollToLatestButton
                    visible={showScrollToLatest}
                    onClick={() => scrollToBottom('smooth')}
                  />
                </div>
              )}

              {/* Generated Specification */}
              <div className="glass-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm text-main">
                    {specType.charAt(0).toUpperCase() + specType.slice(1)} Specification
                  </h3>
                  <button
                    onClick={() => handleDownload('pdf')}
                    disabled={downloadLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadLoading ? (
                      <>
                        <span className="spinner w-3 h-3" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
                <RichTextResponse
                  content={specContent}
                  title={`${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`}
                  showCopy={true}
                  showDownload={true}
                  onDownload={handleDownload}
                  collapsible={true}
                />
              </div>

              {specContent && (
                <DocumentDestinationUpload
                  content={specContent}
                  defaultDocName={`${specType.charAt(0).toUpperCase() + specType.slice(1)} Specification`}
                  documentType={specType === 'functional' ? 'Functional Spec' : 'Technical Spec'}
                  sourceLabel="Spec Assistant"
                  almDocumentType={specType === 'functional' ? 'functional_spec' : 'technical_spec'}
                />
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
    </AppModal>
  )
}
