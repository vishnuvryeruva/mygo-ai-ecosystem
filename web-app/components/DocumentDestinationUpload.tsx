'use client'

import { useState, useCallback } from 'react'
import axios from 'axios'

type UploadStep = 'idle' | 'form' | 'uploading' | 'success' | 'error'
type UploadTarget = 'dms' | 'alm' | 'both'

interface Source { id: string; name: string; type: string }
interface Project { id: string; name: string }

export interface DocumentDestinationUploadProps {
  content: string
  defaultDocName: string
  documentType: string
  sourceLabel: string
  almDocumentType: string
  variant?: 'glass' | 'light'
  className?: string
}

const UploadIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

export default function DocumentDestinationUpload({
  content,
  defaultDocName,
  documentType,
  sourceLabel,
  almDocumentType,
  variant = 'glass',
  className = '',
}: DocumentDestinationUploadProps) {
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>('dms')
  const [docName, setDocName] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const isLight = variant === 'light'

  const loadProjects = useCallback(async (sourceId: string) => {
    setLoadingStep('projects')
    setProjects([])
    setSelectedProject('')
    try {
      const res = await axios.get(`/api/calm/${sourceId}/projects`)
      setProjects(res.data.projects || [])
    } catch {
      setError('Failed to load projects.')
    } finally {
      setLoadingStep('')
    }
  }, [])

  const openUpload = useCallback(async (target: UploadTarget) => {
    setUploadTarget(target)
    setUploadStep('form')
    setError('')
    setSuccessMessage('')
    setDocName(defaultDocName)

    if (target === 'dms') return

    setLoadingStep('sources')
    try {
      const res = await axios.get('/api/sources')
      const calmSources = (res.data.sources || []).filter((s: Source) => s.type === 'CALM')
      setSources(calmSources)
      if (calmSources.length === 1) {
        setSelectedSource(calmSources[0].id)
        await loadProjects(calmSources[0].id)
      }
    } catch {
      setError('Failed to load Cloud ALM sources.')
    } finally {
      setLoadingStep('')
    }
  }, [defaultDocName, loadProjects])

  const uploadToDms = async (name: string) => {
    await axios.post('/api/upload-text-document', {
      name,
      content,
      documentType,
      source: sourceLabel,
    })
  }

  const uploadToAlm = async (name: string) => {
    if (!selectedSource || !selectedProject) {
      throw new Error('Please select a Cloud ALM source and project.')
    }
    await axios.post(`/api/calm/${selectedSource}/push-spec`, {
      name,
      content,
      projectId: selectedProject,
      documentType: almDocumentType,
    })
  }

  const handleUpload = async () => {
    const name = docName.trim()
    if (!name) return

    if ((uploadTarget === 'alm' || uploadTarget === 'both') && (!selectedSource || !selectedProject)) {
      setError('Please select a Cloud ALM source and project.')
      return
    }

    setUploadStep('uploading')
    setError('')

    const errors: string[] = []
    let dmsOk = false
    let almOk = false

    try {
      if (uploadTarget === 'dms' || uploadTarget === 'both') {
        try {
          await uploadToDms(name)
          dmsOk = true
        } catch (err: any) {
          errors.push(err?.response?.data?.error || 'Failed to upload to DMS.')
        }
      }

      if (uploadTarget === 'alm' || uploadTarget === 'both') {
        try {
          await uploadToAlm(name)
          almOk = true
        } catch (err: any) {
          errors.push(err?.response?.data?.error || 'Failed to upload to Cloud ALM.')
        }
      }

      if (errors.length === 0) {
        if (uploadTarget === 'dms') {
          setSuccessMessage(`"${name}" has been added to DMS (Document Hub).`)
        } else if (uploadTarget === 'alm') {
          setSuccessMessage(`"${name}" has been added to Cloud ALM.`)
        } else {
          setSuccessMessage(`"${name}" has been uploaded to DMS and Cloud ALM.`)
        }
        setUploadStep('success')
      } else if (dmsOk || almOk) {
        setError(errors.join(' '))
        setUploadStep('error')
      } else {
        setError(errors.join(' '))
        setUploadStep('error')
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed.')
      setUploadStep('error')
    }
  }

  const reset = () => {
    setUploadStep('idle')
    setUploadTarget('dms')
    setSources([])
    setSelectedSource('')
    setProjects([])
    setSelectedProject('')
    setDocName('')
    setError('')
    setSuccessMessage('')
    setLoadingStep('')
  }

  const idleButtonClass = isLight
    ? 'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all shadow-sm'
    : 'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors'

  const dmsIdleClass = isLight
    ? `${idleButtonClass} border-blue-500/20 bg-blue-50 hover:bg-blue-100 text-blue-700`
    : `${idleButtonClass} border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20`

  const almIdleClass = isLight
    ? `${idleButtonClass} border-emerald-500/20 bg-emerald-50 hover:bg-emerald-100 text-emerald-700`
    : `${idleButtonClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`

  const bothIdleClass = isLight
    ? `${idleButtonClass} border-violet-500/20 bg-violet-50 hover:bg-violet-100 text-violet-700`
    : `${idleButtonClass} border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`

  const panelClass = isLight
    ? 'bg-white border-2 border-slate-100 rounded-2xl shadow-lg overflow-hidden'
    : 'glass-subtle rounded-xl border border-emerald-500/20 overflow-hidden'

  const panelHeaderClass = isLight
    ? 'bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center'
    : 'flex items-center justify-between px-4 py-3 border-b border-white/5'

  const inputClass = isLight
    ? 'w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
    : 'input text-sm'

  const labelClass = isLight
    ? 'text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block'
    : 'input-label text-xs'

  const submitLabel =
    uploadTarget === 'dms' ? 'Upload to DMS' :
    uploadTarget === 'alm' ? 'Upload to Cloud ALM' :
    'Upload to Both'

  const uploadingLabel =
    uploadTarget === 'dms' ? 'Uploading to DMS...' :
    uploadTarget === 'alm' ? 'Uploading to Cloud ALM...' :
    'Uploading to DMS and Cloud ALM...'

  const panelTitle =
    uploadTarget === 'dms' ? 'Upload to DMS' :
    uploadTarget === 'alm' ? 'Upload to Cloud ALM' :
    'Upload to DMS & Cloud ALM'

  if (uploadStep === 'idle') {
    return (
      <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
        <button type="button" onClick={() => openUpload('dms')} className={dmsIdleClass}>
          <UploadIcon />
          Upload to DMS
        </button>
        <button type="button" onClick={() => openUpload('alm')} className={almIdleClass}>
          <UploadIcon />
          Upload to Cloud ALM
        </button>
        <button type="button" onClick={() => openUpload('both')} className={bothIdleClass}>
          <UploadIcon />
          Upload to Both
        </button>
      </div>
    )
  }

  return (
    <div className={`${panelClass} ${className}`}>
      <div className={panelHeaderClass}>
        <h4 className={`font-medium flex items-center gap-2 text-sm ${isLight ? 'text-slate-700 font-bold uppercase tracking-widest text-xs' : 'text-emerald-300'}`}>
          <UploadIcon className={isLight ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {panelTitle}
        </h4>
        <button type="button" onClick={reset} className={isLight ? 'text-slate-400 hover:text-slate-600 font-bold p-1' : 'text-muted hover:text-main text-lg leading-none'}>
          ✕
        </button>
      </div>

      <div className={isLight ? 'p-6' : 'p-4 space-y-3'}>
        {uploadStep === 'uploading' && (
          <div className={`flex flex-col items-center justify-center gap-3 ${isLight ? 'py-6' : 'py-6 text-muted'}`}>
            <div className={isLight ? 'animate-spin h-8 w-8 border-4 border-emerald-500 rounded-full border-t-transparent' : 'spinner w-6 h-6'} />
            <span className={`text-sm ${isLight ? 'font-medium text-slate-600' : ''}`}>{uploadingLabel}</span>
          </div>
        )}

        {uploadStep === 'success' && (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${isLight ? 'bg-emerald-100 text-emerald-600 w-12 h-12 text-2xl shadow-inner' : 'bg-emerald-500/20 text-emerald-400'}`}>
              ✓
            </div>
            <p className={isLight ? 'text-emerald-800 font-bold' : 'text-emerald-300 font-medium'}>Uploaded successfully!</p>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-muted'}`}>{successMessage}</p>
            <button type="button" onClick={reset} className={`mt-2 text-sm underline ${isLight ? 'px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-bold no-underline' : 'text-muted hover:text-main'}`}>
              Done
            </button>
          </div>
        )}

        {uploadStep === 'error' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg text-sm ${isLight ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
              {error}
            </div>
            <button type="button" onClick={() => setUploadStep('form')} className={`text-sm underline ${isLight ? 'text-slate-500' : 'text-muted hover:text-main'}`}>
              ← Try again
            </button>
          </div>
        )}

        {uploadStep === 'form' && (
          <div className={isLight ? 'space-y-4' : 'space-y-3'}>
            {error && (
              <div className={`p-3 rounded-lg text-sm ${isLight ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
                {error}
              </div>
            )}

            <div className={isLight ? '' : 'input-group mb-0'}>
              <label className={labelClass}>Document Name</label>
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                className={inputClass}
                placeholder="Enter document name..."
              />
            </div>

            {(uploadTarget === 'alm' || uploadTarget === 'both') && (
              <>
                {sources.length > 1 && (
                  <div className={isLight ? '' : 'input-group mb-0'}>
                    <label className={labelClass}>Cloud ALM Source</label>
                    <select
                      value={selectedSource}
                      onChange={e => {
                        setSelectedSource(e.target.value)
                        if (e.target.value) loadProjects(e.target.value)
                      }}
                      className={`${inputClass} ${isLight ? '' : 'select'} cursor-pointer`}
                      disabled={loadingStep === 'projects'}
                    >
                      <option value="">Select source...</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {sources.length === 0 && loadingStep !== 'sources' && (
                  <p className="text-sm text-red-400">No Cloud ALM sources configured. Please add one in Sources.</p>
                )}

                {selectedSource && (
                  <div className={isLight ? '' : 'input-group mb-0'}>
                    <label className={labelClass}>
                      Project
                      {loadingStep === 'projects' && <span className="ml-2 text-muted">(loading...)</span>}
                    </label>
                    <select
                      value={selectedProject}
                      onChange={e => setSelectedProject(e.target.value)}
                      className={`${inputClass} ${isLight ? '' : 'select'} cursor-pointer`}
                      disabled={loadingStep === 'projects' || projects.length === 0}
                    >
                      <option value="">Select project...</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={
                !docName.trim() ||
                !!loadingStep ||
                ((uploadTarget === 'alm' || uploadTarget === 'both') && !selectedProject)
              }
              className={isLight
                ? 'w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-widest transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 mt-2'
                : 'w-full btn btn-primary text-sm mt-1'}
            >
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
