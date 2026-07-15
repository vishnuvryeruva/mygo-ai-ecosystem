'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import AppModal from './AppModal'

interface FitGapModalProps {
    onClose: () => void
}

interface Source { id: string; name: string; type: string }
interface Project { id: string; name: string }
interface SapModule { code: string; label: string }

interface DocRef {
    documentId: string
    name: string
    typeLabel: string
    moduleLabel: string
}

interface ChangedPoint { point: string; project_a?: string; project_b?: string }
interface CommonPoint { point: string }

interface Comparison {
    moduleLabel: string
    typeLabel: string
    similarity: number
    documentA: DocRef
    documentB: DocRef
    common: CommonPoint[]
    changed: ChangedPoint[]
    new: CommonPoint[]
    summary: string
    error?: string
}

interface FitGapResult {
    projectA: string
    projectB: string
    comparisons: Comparison[]
    missing: DocRef[]
    new: DocRef[]
    summary: string
    stats: { documentsA: number; documentsB: number; paired: number; compared: number; truncated?: boolean }
}

export default function FitGapModal({ onClose }: FitGapModalProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [projectA, setProjectA] = useState('')
    const [projectB, setProjectB] = useState('')
    const [modules, setModules] = useState<SapModule[]>([])
    const [moduleFilter, setModuleFilter] = useState('')

    const [loadingProjects, setLoadingProjects] = useState(true)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<FitGapResult | null>(null)

    // The projects dropdown needs a CALM source. There is normally exactly one,
    // so it is resolved silently rather than spending a third dropdown on it.
    const loadProjects = useCallback(async () => {
        setLoadingProjects(true)
        setError('')
        try {
            const srcRes = await axios.get('/api/sources')
            const sources: Source[] = srcRes.data.sources ?? srcRes.data ?? []
            const calm = sources.find(s => (s.type || '').toUpperCase() === 'CALM')
            if (!calm) {
                setError('No Cloud ALM source is configured. Add one under Settings to compare projects.')
                return
            }
            const res = await axios.get(`/api/calm/${calm.id}/projects`)
            setProjects(res.data.projects ?? [])
        } catch {
            setError('Failed to load projects from Cloud ALM.')
        } finally {
            setLoadingProjects(false)
        }
    }, [])

    useEffect(() => { loadProjects() }, [loadProjects])

    useEffect(() => {
        axios.get('/api/sap-modules')
            .then(res => setModules(res.data.modules ?? []))
            .catch(() => setModules([]))
    }, [])

    const nameOf = (id: string) => projects.find(p => p.id === id)?.name || ''

    const runComparison = async () => {
        setRunning(true)
        setError('')
        setResult(null)
        try {
            const res = await axios.post('/api/fit-gap', {
                projectAId: projectA,
                projectBId: projectB,
                projectA: nameOf(projectA),
                projectB: nameOf(projectB),
                module: moduleFilter,
            })
            if (res.data.error) setError(res.data.error)
            else setResult(res.data)
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Fit-gap analysis failed.')
        } finally {
            setRunning(false)
        }
    }

    const canRun = projectA && projectB && projectA !== projectB && !running

    return (
        <AppModal onClose={onClose}>
            <div>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title flex items-center gap-2">
                            <span className="text-2xl">⚖️</span>
                            Fit-Gap Analysis
                        </h2>
                        <p className="text-sm text-muted mt-1">
                            Compare two projects&apos; documents on solution design — what&apos;s common, changed, and new
                        </p>
                    </div>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="app-modal-body p-6 space-y-5 overflow-y-auto">
                    {/* Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Project A</label>
                            <select
                                className="doc-hub-filter-select w-full"
                                value={projectA}
                                onChange={e => setProjectA(e.target.value)}
                                disabled={loadingProjects}
                            >
                                <option value="">{loadingProjects ? 'Loading projects…' : 'Select a project'}</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Project B</label>
                            <select
                                className="doc-hub-filter-select w-full"
                                value={projectB}
                                onChange={e => setProjectB(e.target.value)}
                                disabled={loadingProjects}
                            >
                                <option value="">{loadingProjects ? 'Loading projects…' : 'Select a project'}</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id} disabled={p.id === projectA}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">
                                SAP module <span className="text-muted font-normal">(optional — narrows the comparison)</span>
                            </label>
                            <select
                                className="doc-hub-filter-select w-full"
                                value={moduleFilter}
                                onChange={e => setModuleFilter(e.target.value)}
                            >
                                <option value="">All modules</option>
                                {modules.filter(m => m.code !== 'UNCLASSIFIED').map(m => (
                                    <option key={m.code} value={m.code}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={runComparison}
                            disabled={!canRun}
                            className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {running ? 'Analyzing…' : 'Run analysis'}
                        </button>
                    </div>

                    {projectA && projectA === projectB && (
                        <p className="text-sm text-amber-600">Pick two different projects.</p>
                    )}

                    {running && (
                        <p className="text-sm text-muted">
                            Pairing documents by module and type, then comparing each pair on solution design. This
                            takes a few seconds per pair.
                        </p>
                    )}

                    {error && (
                        <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            <div className="p-3 rounded bg-slate-50 border border-slate-200">
                                <p className="text-sm" dangerouslySetInnerHTML={{ __html: boldify(result.summary) }} />
                                <p className="text-xs text-muted mt-2">
                                    {result.stats.documentsA} document(s) in {result.projectA} ·{' '}
                                    {result.stats.documentsB} in {result.projectB} ·{' '}
                                    {result.stats.paired} paired · {result.stats.compared} compared
                                </p>
                            </div>

                            {result.comparisons.map((c, i) => (
                                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                        <span className="font-medium text-sm">
                                            {c.moduleLabel} · {c.typeLabel}
                                        </span>
                                        <span className="text-xs text-muted">match {(c.similarity * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="px-4 py-2 text-xs text-muted border-b border-slate-100">
                                        <div>A: {c.documentA.name}</div>
                                        <div>B: {c.documentB.name}</div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {c.error && <p className="text-sm text-red-600">{c.error}</p>}
                                        {c.summary && <p className="text-sm">{c.summary}</p>}

                                        <PointList title="Common" tone="green" points={c.common.map(p => p.point)} />

                                        {c.changed.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                                                    Changed ({c.changed.length})
                                                </h4>
                                                <ul className="space-y-2">
                                                    {c.changed.map((p, j) => (
                                                        <li key={j} className="text-sm border-l-2 border-amber-400 pl-3">
                                                            <div className="font-medium">{p.point}</div>
                                                            {p.project_a && <div className="text-xs text-muted">A: {p.project_a}</div>}
                                                            {p.project_b && <div className="text-xs text-muted">B: {p.project_b}</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <PointList title="New in B" tone="blue" points={c.new.map(p => p.point)} />
                                    </div>
                                </div>
                            ))}

                            <GapList
                                title={`Only in ${result.projectA} — no counterpart in ${result.projectB}`}
                                docs={result.missing}
                            />
                            <GapList
                                title={`Only in ${result.projectB} — not present in ${result.projectA}`}
                                docs={result.new}
                            />
                        </div>
                    )}
                </div>
            </div>
        </AppModal>
    )
}

function PointList({ title, tone, points }: { title: string; tone: 'green' | 'blue'; points: string[] }) {
    if (points.length === 0) return null
    const color = tone === 'green' ? 'text-green-700 border-green-400' : 'text-blue-700 border-blue-400'
    return (
        <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${color.split(' ')[0]}`}>
                {title} ({points.length})
            </h4>
            <ul className="space-y-1">
                {points.map((p, i) => (
                    <li key={i} className={`text-sm border-l-2 pl-3 ${color.split(' ')[1]}`}>{p}</li>
                ))}
            </ul>
        </div>
    )
}

function GapList({ title, docs }: { title: string; docs: DocRef[] }) {
    if (!docs || docs.length === 0) return null
    return (
        <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-2">{title} ({docs.length})</h4>
            <ul className="space-y-1">
                {docs.map(d => (
                    <li key={d.documentId} className="text-sm flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.moduleLabel}</span>
                        <span className="text-xs text-muted">{d.typeLabel}</span>
                        <span>{d.name}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

/** The backend summary uses **bold** markers; render just those, escaping the rest. */
function boldify(text: string): string {
    const escaped = (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
