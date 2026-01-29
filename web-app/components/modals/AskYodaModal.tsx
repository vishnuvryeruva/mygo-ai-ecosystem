'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'

interface AskYodaModalProps {
  onClose: () => void
}

export default function AskYodaModal({ onClose }: AskYodaModalProps) {
  console.log('AskYodaModal mounted')
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await axios.post('/api/ask-yoda', { query })
      setAnswer(response.data.answer)
    } catch (error) {
      console.error('Error asking Yoda:', error)
      setAnswer('Error: Could not get answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            Ask Yoda
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body p-6">
          {/* Info Box */}
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">ℹ️ Knowledge Base</h4>
            <p className="text-sm text-blue-300">
              To add or manage documents in the knowledge base, use the <strong>Document Upload</strong> tile on the main page.
            </p>
          </div>

          {/* Query Form */}
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-muted mb-2">
              Ask a Question
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Query historical blueprints, specs, tickets, and test cases..."
              className="input w-full"
              rows={4}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="mt-4 px-6 py-2 btn btn-primary w-full sm:w-auto"
            >
              {loading ? <LoadingSpinner size="sm" text="Asking..." /> : 'Ask Yoda'}
            </button>
          </form>

          {/* Answer with Rich Text */}
          {answer && (
            <RichTextResponse
              content={answer}
              title="Answer"
              showCopy={true}
              showDownload={false}
              collapsible={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

