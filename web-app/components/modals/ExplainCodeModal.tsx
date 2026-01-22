'use client'

import { useState } from 'react'
import axios from 'axios'

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <span className="text-2xl">💻</span>
            Explain Code
          </h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleExplain}>
            <div className="input-group">
              <label className="input-label">Program/Class/Function Name (Optional)</label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g., Z_MY_PROGRAM"
                className="input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Code Type</label>
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
              <label className="input-label">Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here or enter program name to fetch from SAP..."
                className="input font-mono text-sm"
                rows={12}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!code.trim() && !programName.trim())}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner w-4 h-4" />
                  Explaining...
                </span>
              ) : 'Explain Code'}
            </button>
          </form>

          {explanation && (
            <div className="mt-6 glass-subtle p-4">
              <h3 className="font-semibold text-white mb-3">📖 Explanation:</h3>
              <div className="text-gray-300 whitespace-pre-wrap text-sm">{explanation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
