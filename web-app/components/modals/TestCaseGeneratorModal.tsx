'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
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
      // Always get text preview first
      const response = await axios.post('/api/generate-test-cases', {
        code,
        test_type: testType,
        format: 'preview'  // Request text format for preview
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

    // Map format to backend format
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

      // Determine mime type and extension
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Test Case Generator</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleGenerate}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Type
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="manual">Manual Test Cases</option>
                <option value="unit">ABAP Unit Test Skeletons</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the code you want to generate test cases for..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Test Cases'}
            </button>
          </form>

          {/* Generated Test Cases with Rich Text and Collapsible Sections */}
          {testCases && (
            <div className="mt-6">
              {downloadLoading && (
                <div className="mb-4 flex items-center justify-center text-gray-600">
                  <LoadingSpinner size="sm" text="Preparing download..." />
                </div>
              )}

              {/* Download Format Buttons */}
              <div className="mb-4 flex gap-2 justify-end">
                <button
                  onClick={() => handleDownload('docx')}
                  disabled={downloadLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Word
                </button>
                <button
                  onClick={() => handleDownload('excel')}
                  disabled={downloadLoading}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel
                </button>
              </div>

              <RichTextResponse
                content={testCases}
                title="Generated Test Cases"
                showCopy={true}
                showDownload={false}
                collapsible={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
