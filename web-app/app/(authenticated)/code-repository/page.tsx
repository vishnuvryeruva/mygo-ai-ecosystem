'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function CodeRepositoryPage() {
    const [sources, setSources] = useState<any[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)

    // OData Filter State
    // Default to empty string to use the exact configured API endpoint by default (avoids fetching Service Document)
    const [entitySet, setEntitySet] = useState('')
    const [filterQuery, setFilterQuery] = useState('')
    const [top, setTop] = useState('50')
    const [skip, setSkip] = useState('0')

    const [rawJsonResponse, setRawJsonResponse] = useState<any>(null)
    const [fetchedRecords, setFetchedRecords] = useState<any[]>([])
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
    const [previewRecord, setPreviewRecord] = useState<any>(null)
    const [advisorQuery, setAdvisorQuery] = useState('')
    const [advisorResponse, setAdvisorResponse] = useState('')
    const [isAdvising, setIsAdvising] = useState(false)
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table')

    // Toast State
    const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    useEffect(() => {
        fetchSources()
    }, [])

    const fetchSources = async () => {
        try {
            const res = await axios.get('/api/sources')
            const allSources = res.data.sources || []
            const btpOnly = allSources.filter((s: any) => s.type === 'BTP')
            setSources(btpOnly)
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        }
    }

    const handleSync = async () => {
        if (!selectedSourceId) return
        setIsLoading(true)
        setRawJsonResponse(null)
        try {
            const res = await axios.get(`/api/btp/${selectedSourceId}/fetch-code`, {
                params: {
                    entity_set: entitySet,
                    filter_query: filterQuery,
                    top: top,
                    skip: skip
                }
            })

            // Extract array of records
            let records: any[] = []
            if (Array.isArray(res.data.data)) records = res.data.data
            else if (res.data.data?.value && Array.isArray(res.data.data.value)) records = res.data.data.value
            else if (res.data.data?.d?.results && Array.isArray(res.data.data.d.results)) records = res.data.data.d.results
            else if (res.data.data && typeof res.data.data === 'object' && res.data.data.Object) records = [res.data.data]

            // Map to standard table structure
            const sourceName = sources.find(s => s.id === selectedSourceId)?.name || 'Unknown'
            const savedTime = new Date().toLocaleString()
            const mappedRecords = records.map((r, i) => {
                const name = r.ObjectName || r.Objname || r.name || r.Object || r.Title || r.ID || `Item_${i}`
                const type = r.ObjectType || r.Objtype || r.type || r.Type || '-'
                const id = r.Object ? `${r.Object}_${name}_${i}` : `${name}_${i}`
                return {
                    id,
                    name,
                    type,
                    source: sourceName,
                    entitySet: entitySet || 'Configured Endpoint',
                    savedAt: savedTime,
                    rawData: r
                }
            })

            setFetchedRecords(mappedRecords)
            setViewMode('table')
            setRawJsonResponse(res.data.data)
            setToastMessage({ text: `Fetch complete. Found ${mappedRecords.length} records.`, type: 'success' })
            setTimeout(() => setToastMessage(null), 3000)
        } catch (err: any) {
            console.error('Sync failed:', err)
            setToastMessage({ text: err.response?.data?.error || 'Failed to sync BTP source', type: 'error' })
            setTimeout(() => setToastMessage(null), 5000)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAskAgent = async () => {
        if (!advisorQuery) return
        setIsAdvising(true)
        setAdvisorResponse('')
        try {
            const selectedItems = fetchedRecords.filter(r => selectedRecords.has(r.id))

            // 1. Fetch actual source code for each selected object
            const codeContents: string[] = []

            for (const item of selectedItems) {
                // Determine the correct object name field from raw data
                const objName = item.rawData.Objname || item.rawData.ObjectName || item.rawData.name || item.rawData.Object
                if (!objName) continue

                try {
                    setToastMessage({ text: `Fetching source for ${objName}...`, type: 'success' })
                    const res = await axios.get(`/api/btp/${selectedSourceId}/fetch-code`, {
                        params: {
                            entity_set: 'sourcecodeSet',
                            filter_query: `Objname eq '${objName}'`,
                            top: '1000'
                        }
                    })

                    // Extract code lines from the response
                    let lines: any[] = []
                    const responseData = res.data.data
                    if (Array.isArray(responseData)) lines = responseData
                    else if (responseData?.value && Array.isArray(responseData.value)) lines = responseData.value
                    else if (responseData?.d?.results && Array.isArray(responseData.d.results)) lines = responseData.d.results

                    // Join the code lines (assuming SAP returns objects with 'Line' or 'Content' fields)
                    const fullCode = lines.map(line => line.Line || line.Content || line.Linecontent || JSON.stringify(line)).join('\n')
                    if (fullCode.trim()) {
                        codeContents.push(`--- OBJECT: ${objName} ---\n${fullCode}`)
                    }
                } catch (fetchErr) {
                    console.error(`Failed to fetch code for ${objName}:`, fetchErr)
                }
            }

            if (codeContents.length === 0) {
                setAdvisorResponse('Could not retrieve any source code for the selected objects. Please ensure "sourcecodeSet" is available.')
                setIsAdvising(false)
                return
            }

            const promptContext = codeContents.join('\n\n')

            // 2. Call the AI Explainer with the actual code
            setToastMessage({ text: `Analyzing code with AI...`, type: 'success' })
            const res = await axios.post('/api/explain-code', {
                code: promptContext,
                code_type: 'ABAP',
                program_name: selectedItems.length === 1 ? selectedItems[0].name : 'Multiple Objects'
            })

            setAdvisorResponse(res.data.explanation || JSON.stringify(res.data))
            setToastMessage({ text: `Analysis complete!`, type: 'success' })
            setTimeout(() => setToastMessage(null), 3000)
        } catch (err: any) {
            console.error(err)
            setAdvisorResponse('Error communicating with AI Agent.')
            setToastMessage({ text: 'AI analysis failed', type: 'error' })
            setTimeout(() => setToastMessage(null), 5000)
        } finally {
            setIsAdvising(false)
        }
    }

    return (
        <div className="doc-hub-page">
            <div className="doc-hub-header">
                <div className="doc-hub-header-left">
                    <div className="doc-hub-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="doc-hub-title">Code Repository</h1>
                        <p className="doc-hub subtitle text-slate-500">Fetch raw JSON data from BTP sources using OData filters</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        className="btn btn-primary"
                        onClick={handleSync}
                        disabled={isLoading || !selectedSourceId}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                            <path d="M21 2v6h-6" />
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M3 22v-6h6" />
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                        {isLoading ? 'Fetching...' : 'Fetch Code'}
                    </button>
                </div>
            </div>

            <div className="doc-hub-filters" style={{ flexWrap: 'wrap', gap: '1rem', padding: '1.5rem' }}>
                <div className="doc-hub-filter-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>SOURCE & QUERY</span>
                </div>

                <select
                    className="doc-hub-filter-select"
                    style={{ minWidth: '240px' }}
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                >
                    <option value="">Choose a source...</option>
                    {sources.map(s => {
                        let hostname = 'N/A';
                        try {
                            if (s.config?.apiEndpoint) {
                                hostname = new URL(s.config.apiEndpoint).hostname;
                            }
                        } catch (e) {
                            hostname = 'Invalid URL';
                        }
                        return <option key={s.id} value={s.id}>{s.name} ({hostname})</option>;
                    })}
                </select>

                <select
                    className="doc-hub-filter-select"
                    value={entitySet}
                    onChange={(e) => setEntitySet(e.target.value)}
                >
                    <option value="">Use Configured Endpoint</option>
                    <option value="ObjlistSet">ObjlistSet</option>
                    <option value="objectsSet">objectsSet</option>
                    <option value="sourcecodeSet">sourcecodeSet</option>
                </select>

                <input
                    type="text"
                    className="doc-hub-filter-select"
                    style={{ flex: 1, minWidth: '200px' }}
                    placeholder="$filter (e.g. Package eq 'ZDEV')"
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                />

                <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">SKIP</span>
                        <input
                            type="text"
                            className="doc-hub-filter-select"
                            style={{ width: '60px' }}
                            placeholder="$skip"
                            value={skip}
                            onChange={e => setSkip(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">TOP</span>
                        <input
                            type="text"
                            className="doc-hub-filter-select"
                            style={{ width: '60px' }}
                            placeholder="$top"
                            value={top}
                            onChange={e => setTop(e.target.value)}
                        />
                    </div>
                </div>

                <p className="text-xs text-slate-500 mt-2 w-full">
                    Note: Adjust the parameters to fetch specific raw data collections from the backend.
                </p>
            </div>

            <div className="mb-4">
                <div className="flex gap-4 border-b border-slate-200 mb-4 pb-0">
                    <button onClick={() => setViewMode('table')} className={`font-medium pb-2 px-1 ${viewMode === 'table' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Table View</button>
                    <button onClick={() => setViewMode('json')} className={`font-medium pb-2 px-1 ${viewMode === 'json' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Raw JSON View</button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-500 bg-white rounded-xl shadow border border-slate-200">
                        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 rounded-full border-t-transparent mb-4"></div>
                        <p className="font-mono text-sm">Waiting for backend data...</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="p-3 w-10">
                                        <input type="checkbox" onChange={(e) => {
                                            if (e.target.checked) setSelectedRecords(new Set(fetchedRecords.map(r => r.id)))
                                            else setSelectedRecords(new Set())
                                        }} checked={fetchedRecords.length > 0 && selectedRecords.size === fetchedRecords.length} />
                                    </th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Entity Set</th>
                                    <th className="p-3">Source</th>
                                    <th className="p-3">Saved At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fetchedRecords.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No records fetched yet. Click "Fetch Code" to populate.</td></tr>
                                ) : (
                                    fetchedRecords.map(record => (
                                        <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-3">
                                                <input type="checkbox" checked={selectedRecords.has(record.id)} onChange={(e) => {
                                                    const next = new Set(selectedRecords)
                                                    if (e.target.checked) next.add(record.id)
                                                    else next.delete(record.id)
                                                    setSelectedRecords(next)
                                                }} />
                                            </td>
                                            <td className="p-3 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setPreviewRecord(record)} title="Click to preview file data">{record.name}</td>
                                            <td className="p-3 text-slate-600">{record.type}</td>
                                            <td className="p-3 text-slate-600">{record.entitySet}</td>
                                            <td className="p-3 text-slate-600">{record.source}</td>
                                            <td className="p-3 text-slate-500 text-xs">{record.savedAt}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-slate-900 rounded-xl p-6 shadow-xl border border-slate-800 overflow-hidden" style={{ minHeight: '500px' }}>
                        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="ml-4 text-slate-400 text-xs font-mono">raw_odata_response.json</span>
                            </div>
                            {rawJsonResponse && (
                                <button className="text-slate-400 hover:text-white transition-colors" onClick={() => { navigator.clipboard.writeText(JSON.stringify(rawJsonResponse, null, 2)); setToastMessage({ text: 'Copied to clipboard', type: 'success' }); setTimeout(() => setToastMessage(null), 2000); }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                </button>
                            )}
                        </div>
                        <pre className="text-sm font-mono text-emerald-400 overflow-x-auto overflow-y-auto max-h-[70vh]" style={{ lineHeight: 1.6 }}>{rawJsonResponse ? JSON.stringify(rawJsonResponse, null, 2) : '// Select source and click "Fetch Code" to see raw data'}</pre>
                    </div>
                )}
            </div>

            {/* AI Agent Interaction */}
            {selectedRecords.size > 0 && (
                <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">AI Code Agent</h2>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        {selectedRecords.size} record(s) selected for analysis.
                    </p>
                    <textarea
                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:blue-500 focus:outline-none mb-3"
                        rows={3}
                        placeholder="Ask the AI agent about the selected data (e.g., 'What does this class do?' or 'Summarize these objects')"
                        value={advisorQuery}
                        onChange={(e) => setAdvisorQuery(e.target.value)}
                    />
                    <button
                        className="btn btn-primary px-4 py-2 rounded-lg text-sm font-medium"
                        onClick={handleAskAgent}
                        disabled={isAdvising || !advisorQuery}
                    >
                        {isAdvising ? 'Agent is analyzing...' : 'Ask AI Agent'}
                    </button>
                    {advisorResponse && (
                        <div className="mt-4 p-4 bg-slate-800 rounded-lg text-sm text-emerald-400 whitespace-pre-wrap font-mono relative overflow-x-auto shadow-inner">
                            <div className="absolute top-2 right-2 text-xs text-slate-500">AI Response</div>
                            {advisorResponse}
                        </div>
                    )}
                </div>
            )}

            {/* Preview Modal */}
            {previewRecord && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewRecord(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{previewRecord.name}</h3>
                                <p className="text-xs text-slate-500">Type: {previewRecord.type} | Entity Set: {previewRecord.entitySet}</p>
                            </div>
                            <button onClick={() => setPreviewRecord(null)} className="text-slate-400 hover:text-slate-700">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex-1 bg-slate-900 rounded-b-xl border-t border-slate-800">
                            <pre className="text-sm font-mono text-emerald-400">
                                {JSON.stringify(previewRecord.rawData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, padding: '1rem 1.5rem', borderRadius: '0.5rem', color: 'white', fontWeight: 500, background: toastMessage.type === 'success' ? '#10b981' : '#ef4444', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out' }}>
                    {toastMessage.text}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }` }} />
        </div>
    )
}
