'use client'

import { useState } from 'react'
import axios from 'axios'
import RichTextResponse from '../RichTextResponse'

interface TestCaseGeneratorModalProps {
  onClose: () => void
}

export default function TestCaseGeneratorModal({ onClose }: TestCaseGeneratorModalProps) {
  const [code, setCode] = useState('')
  const [testType, setTestType] = useState('manual')
  const [loading, setLoading] = useState(false)
  const [testCases, setTestCases] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(false)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setTestCases('')

    try {
      const response = await axios.post('/api/generate-test-cases', {
        code,
        test_type: testType,
        format: 'preview'
      })
      setTestCases(response.data.test_cases || response.data.testCases || response.data)
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
                <div className="mb-4 flex items-center justify-center text-gray-400">
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

              <div className="glass-subtle p-4">
                <RichTextResponse
                  content={testCases}
                  title="Generated Test Cases"
                  showCopy={true}
                  showDownload={false}
                  collapsible={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
