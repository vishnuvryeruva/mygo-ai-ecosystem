'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'

interface ExplainCodeModalProps {
  onClose: () => void
}

export default function ExplainCodeModal({ onClose }: ExplainCodeModalProps) {
  const [code, setCode] = useState('')
  const [codeType, setCodeType] = useState('ABAP')
  const [programName, setProgramName] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExplain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    try {
      const response = await axios.post('/api/explain-code', {
        code,
        code_type: codeType,
        program_name: programName
      })
      setExplanation(response.data.explanation)
    } catch (error) {
      console.error('Error explaining code:', error)
      alert('Error explaining code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Explain Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleExplain}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Program/Class/Function Name (Optional)
              </label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g., Z_MY_PROGRAM"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code Type
              </label>
              <select
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ABAP">ABAP</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here or enter program name to fetch from SAP..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                rows={12}
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!code.trim() && !programName.trim())}
              className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" text="Explaining..." /> : 'Explain Code'}
            </button>
          </form>

          {explanation && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Explanation:</h3>
              <div className="text-gray-700 whitespace-pre-wrap">{explanation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

