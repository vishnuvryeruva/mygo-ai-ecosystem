'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'
import SourceReferences, { Reference } from '../SourceReferences'
import { useAutoResize } from '@/hooks/useAutoResize'

interface AskYodaModalProps {
  onClose: () => void
}

export default function AskYodaModal({ onClose }: AskYodaModalProps) {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [references, setReferences] = useState<Reference[]>([])
  const [loading, setLoading] = useState(false)
  const [sapStatus, setSapStatus] = useState<{ connected: boolean; systemId?: string; client?: string; host?: string } | null>(null)
  const queryRef = useAutoResize(query, 4)

  const getAuthConfig = () => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('mygo-token') || localStorage.getItem('token')) : null
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  }

  useEffect(() => {
    // Check live SAP ADT connection status
    const checkSap = async () => {
      try {
        const res = await axios.get('/api/sap/adt/status', getAuthConfig())
        if (res.data?.connected) {
          setSapStatus({
            connected: true,
            systemId: res.data.systemId || 'HMF',
            client: res.data.client || '300',
            host: res.data.host || '192.168.171.91'
          })
        }
      } catch (e) {
        console.log('SAP status check notice:', e)
      }
    }
    checkSap()
  }, [])

  const executeAsk = async (textToAsk: string) => {
    if (!textToAsk.trim()) return

    setLoading(true)
    setReferences([])
    try {
      const response = await axios.post('/api/ask-yoda', { query: textToAsk }, getAuthConfig())
      setAnswer(response.data.answer)
      setReferences(response.data.references || [])
    } catch (error) {
      console.error('Error asking Yoda:', error)
      setAnswer('Error: Could not get answer. Please try again.')
      setReferences([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    executeAsk(query)
  }

  const handleChipClick = (chipText: string) => {
    setQuery(chipText)
    executeAsk(chipText)
  }

  const quickPrompts = [
    { label: '🔍 Inspect CL_ABAP_TYPEDESCR', text: 'Inspect class CL_ABAP_TYPEDESCR and explain its methods and usage' },
    { label: '📦 Objects in $TMP', text: 'What objects are in package $TMP?' },
    { label: '🚀 My Open Transports', text: 'What transport requests are open in SAP for user YRAJPUT?' },
    { label: '📋 Sales Order Tables', text: 'What tables exist for sales orders (e.g. VBAK, VBAP) and how are they linked?' },
    { label: '🟢 Live SAP Status', text: 'What SAP system is connected and what is its status?' }
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <h2 className="modal-title font-bold text-lg">Ask Yoda</h2>
              <p className="text-xs text-slate-400">Directly connected to SAP S/4HANA & Knowledge Base</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body p-6">
          {/* SAP Live Status Banner */}
          {sapStatus?.connected ? (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-semibold text-emerald-300">
                  Live SAP S/4HANA Connected: <strong>{sapStatus.systemId} (Client {sapStatus.client})</strong> at {sapStatus.host}
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">ADT REST Active</span>
            </div>
          ) : (
            <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-blue-300">
                Connected to Knowledge Base. Manage documents in <strong>Document Hub</strong> or configure SAP in <strong>Settings</strong>.
              </span>
            </div>
          )}

          {/* Quick Prompts */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Instant SAP Prompts:
            </label>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(p.text)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700/70 text-slate-200 border border-slate-700/50 hover:border-blue-500/40 transition-all disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Query Form */}
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">
              Ask a Question or Query SAP
            </label>
            <textarea
              ref={queryRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about live ABAP classes, DDIC tables, package objects, transports, or blueprints..."
              className="input w-full"
              style={{ resize: 'none' }}
            />
            <div className="mt-3 flex gap-3">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-2 btn btn-primary flex items-center gap-2"
              >
                {loading ? <LoadingSpinner size="sm" text="Querying SAP & RAG..." /> : 'Ask Yoda'}
              </button>
            </div>
          </form>

          {/* Answer with Rich Text */}
          {answer && (
            <div className="mt-4 pt-4 border-t border-slate-700/40">
              <RichTextResponse content={answer} />
              <SourceReferences references={references} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

