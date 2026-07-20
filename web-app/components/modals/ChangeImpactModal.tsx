'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import AppModal from './AppModal'

interface ChangeImpactModalProps {
    onClose: () => void
}

interface Project { id: string; name: string }
interface SapModule { code: string; label: string }

interface DocRef {
    documentId: string
    name: string
    type: string
    typeLabel: string
    module: string
    moduleLabel: string
    summary: string
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

interface CoverageRow {
    module: string
    moduleLabel: string
    type: string
    typeLabel: string
    countA: number
    countB: number
    onlyInA: boolean
    onlyInB: boolean
}

interface ChangeImpactResult {
    projectA: string
    projectB: string
    coverage: CoverageRow[]
    commonToBoth: Comparison[]
    newInSource: DocRef[]
    removedInComparison: DocRef[]
    summary: string
    stats: { documentsA: number; documentsB: number; paired: number; compared: number; truncated?: boolean }
}

export default function ChangeImpactModal({ onClose }: ChangeImpactModalProps) {
    const [projects, setProjects] = useState<Project[]>([])
    const [projectA, setProjectA] = useState('')
    const [projectB, setProjectB] = useState('')
    const [modules, setModules] = useState<SapModule[]>([])
    const [moduleFilter, setModuleFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')

    const [loadingProjects, setLoadingProjects] = useState(true)
    const [loadingTable, setLoadingTable] = useState(false)
    const [running, setRunning] = useState(false)
    // Distinguishes "table loaded, nothing analysed yet" from "analysis returned
    // nothing" — otherwise an empty result reads as a broken screen.
    const [analysed, setAnalysed] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<ChangeImpactResult | null>(null)

    // Only projects synced into Yoda (Document Hub) can be analysed — CALM
    // projects with no synced documents have nothing to compare.
    const loadProjects = useCallback(async () => {
        setLoadingProjects(true)
        setError('')
        try {
            const res = await axios.get('/api/synced-projects')
            const synced: Project[] = res.data.projects ?? []
            setProjects(synced)
            if (synced.length === 0) {
                setError('No projects are synced to Yoda yet. Sync documents from Data Sources first, then run Change Impact Analysis.')
            }
        } catch {
            setError('Failed to load synced projects.')
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

    // Both projects chosen → show the coverage table straight away. It is pure
    // counting on the backend, so this costs nothing and gives the user something
    // to aim at before committing to an analysis.
    useEffect(() => {
        if (!projectA || !projectB || projectA === projectB) {
            setResult(null)
            return
        }
        let cancelled = false
        setLoadingTable(true)
        setError('')
        axios.post('/api/change-impact', {
            projectAId: projectA, projectBId: projectB,
            projectA: nameOf(projectA), projectB: nameOf(projectB),
            tableOnly: true,
        })
            .then(res => { if (!cancelled) { setResult(res.data); setAnalysed(false) } })
            .catch(() => { if (!cancelled) setError('Failed to load the document coverage table.') })
            .finally(() => { if (!cancelled) setLoadingTable(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectA, projectB])

    const runComparison = async (moduleCode = moduleFilter, typeCode = typeFilter) => {
        setRunning(true)
        setError('')
        try {
            const res = await axios.post('/api/change-impact', {
                projectAId: projectA,
                projectBId: projectB,
                projectA: nameOf(projectA),
                projectB: nameOf(projectB),
                module: moduleCode,
                docType: typeCode,
            })
            if (res.data.error) setError(res.data.error)
            else { setResult(res.data); setAnalysed(true) }
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Change impact analysis failed.')
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
                            Change Impact Analysis
                        </h2>
                        <p className="text-sm text-muted mt-1">
                            Compare two projects synced to Yoda on solution design — configuration,
                            process and architecture, not wording
                        </p>
                    </div>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="app-modal-body p-6 space-y-5 overflow-y-auto">
                    {/* Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Source project</label>
                            <select
                                className="doc-hub-filter-select w-full"
                                value={projectA}
                                onChange={e => setProjectA(e.target.value)}
                                disabled={loadingProjects || projects.length === 0}
                            >
                                <option value="">
                                    {loadingProjects
                                        ? 'Loading projects…'
                                        : projects.length === 0
                                            ? 'No synced projects'
                                            : 'Select a project'}
                                </option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Comparison project</label>
                            <select
                                className="doc-hub-filter-select w-full"
                                value={projectB}
                                onChange={e => setProjectB(e.target.value)}
                                disabled={loadingProjects || projects.length === 0}
                            >
                                <option value="">
                                    {loadingProjects
                                        ? 'Loading projects…'
                                        : projects.length === 0
                                            ? 'No synced projects'
                                            : 'Select a project'}
                                </option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id} disabled={p.id === projectA}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">
                                SAP module <span className="text-muted font-normal">(optional — narrows the analysis)</span>
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
                            onClick={() => runComparison()}
                            disabled={!canRun}
                            className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {running ? 'Analyzing…' : 'Run analysis'}
                        </button>
                    </div>

                    {projectA && projectA === projectB && (
                        <p className="text-sm text-amber-600">Pick two different projects.</p>
                    )}

                    {loadingTable && <p className="text-sm text-muted">Loading document coverage…</p>}

                    {running && (
                        <p className="text-sm text-muted">
                            Pairing documents by module and type, then comparing each pair on solution design. This
                            takes a few seconds per pair.
                        </p>
                    )}

                    {error && (
                        <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
                    )}

                    {/* Coverage table — what exists on each side, before spending anything */}
                    {result && result.coverage?.length > 0 && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                <h4 className="text-sm font-semibold">Documents by module and type</h4>
                                <p className="text-xs text-muted mt-0.5">
                                    Pick a row to analyse just that section
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left border-b border-slate-200">
                                            <th className="px-4 py-2 font-medium">Module</th>
                                            <th className="px-4 py-2 font-medium">Document type</th>
                                            <th className="px-4 py-2 font-medium text-right">{result.projectA}</th>
                                            <th className="px-4 py-2 font-medium text-right">{result.projectB}</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.coverage.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                                <td className="px-4 py-2">{row.moduleLabel}</td>
                                                <td className="px-4 py-2">{row.typeLabel}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{row.countA}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{row.countB}</td>
                                                <td className="px-4 py-2 text-right">
                                                    {row.countA > 0 && row.countB > 0 ? (
                                                        <button
                                                            className="text-xs text-teal-700 hover:underline disabled:opacity-40"
                                                            disabled={running}
                                                            onClick={() => {
                                                                setModuleFilter(row.module)
                                                                setTypeFilter(row.type)
                                                                runComparison(row.module, row.type)
                                                            }}
                                                        >
                                                            Analyse
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-muted">
                                                            {row.onlyInB ? `only in ${result.projectB}` : `only in ${result.projectA}`}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {result && analysed && (
                        <div className="space-y-4">
                            <div className="p-3 rounded bg-slate-50 border border-slate-200">
                                <p className="text-sm" dangerouslySetInnerHTML={{ __html: boldify(result.summary) }} />
                                <p className="text-xs text-muted mt-2">
                                    {result.stats.documentsA} document(s) in {result.projectA} ·{' '}
                                    {result.stats.documentsB} in {result.projectB} ·{' '}
                                    {result.stats.paired} paired · {result.stats.compared} compared
                                </p>
                            </div>

                            {result.commonToBoth.map((c, i) => (
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

                                        <PointList title="Common to both" tone="green" points={c.common.map(p => p.point)} />

                                        {c.changed.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                                                    Changed ({c.changed.length})
                                                </h4>
                                                <ul className="space-y-2">
                                                    {c.changed.map((p, j) => (
                                                        <li key={j} className="text-sm border-l-2 border-amber-400 pl-3">
                                                            <div className="font-medium">{p.point}</div>
                                                            {p.project_a && (
                                                                <div className="text-xs text-muted">{result.projectA}: {p.project_a}</div>
                                                            )}
                                                            {p.project_b && (
                                                                <div className="text-xs text-muted">{result.projectB}: {p.project_b}</div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <PointList
                                            title={`New in ${result.projectB}`}
                                            tone="blue"
                                            points={c.new.map(p => p.point)}
                                        />
                                    </div>
                                </div>
                            ))}

                            <GapList
                                title={`New in source — in ${result.projectA}, not in ${result.projectB}`}
                                docs={result.newInSource}
                            />
                            <GapList
                                title={`Removed in comparison — in ${result.projectB}, not in ${result.projectA}`}
                                docs={result.removedInComparison}
                            />

                            {result.commonToBoth.length === 0 &&
                                result.newInSource.length === 0 &&
                                result.removedInComparison.length === 0 && (
                                    <p className="text-sm text-muted">
                                        Nothing to report for this section.
                                    </p>
                                )}
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

/** A gap section. Leads with what each document *says* — the filename is a
 *  secondary detail, because "RICEF DOC3" tells a consultant nothing. */
function GapList({ title, docs }: { title: string; docs: DocRef[] }) {
    if (!docs || docs.length === 0) return null
    return (
        <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">{title} ({docs.length})</h4>
            <ul className="space-y-3">
                {docs.map(d => (
                    <li key={d.documentId} className="border-l-2 border-slate-300 pl-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.moduleLabel}</span>
                            <span className="text-xs text-muted">{d.typeLabel}</span>
                        </div>
                        <p className="text-sm">
                            {d.summary || <span className="text-muted italic">No summary yet — re-sync this document to generate one.</span>}
                        </p>
                        <p className="text-xs text-muted mt-1">{d.name}</p>
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
