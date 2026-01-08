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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Ask Yoda</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Info Box */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">ℹ️ Knowledge Base</h4>
            <p className="text-sm text-blue-800">
              To add or manage documents in the knowledge base, use the <strong>Document Upload</strong> tile on the main page.
            </p>
          </div>

          {/* Query Form */}
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ask a Question
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Query historical blueprints, specs, tickets, and test cases..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={4}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

