'use client'

import { useState } from 'react'
import axios from 'axios'
import AppModal from './AppModal'
import { useAutoResize } from '@/hooks/useAutoResize'

interface ExplainCodeModalProps {
  onClose: () => void
  initialData?: {
    code?: string
    language?: string
    programName?: string
    autoProcess?: boolean
  }
}

export default function ExplainCodeModal({ onClose, initialData }: ExplainCodeModalProps) {
  const [code, setCode] = useState(initialData?.code || '')
  const [codeType, setCodeType] = useState(initialData?.language || 'ABAP')
  const [programName, setProgramName] = useState(initialData?.programName || '')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const codeRef = useAutoResize(code, 12)

  useEffect(() => {
    if (initialData?.autoProcess && initialData?.code) {
      handleExplain()
    }
  }, [])

  const handleExplain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const targetCode = code.trim() || initialData?.code?.trim()
    if (!targetCode) return

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
    <AppModal onClose={onClose}>
      <div>
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
              <h3 className="font-semibold text-heading mb-3">📖 Explanation:</h3>
              <div className="text-muted whitespace-pre-wrap text-sm">{explanation}</div>
            </div>
          )}
        </div>
      </div>
    </AppModal>
  )
}
