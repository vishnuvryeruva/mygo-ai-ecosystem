'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import AIAgentsDropdown from '@/components/AIAgentsDropdown'

// SAP Object Type Icons mapping
const TypeIcon = ({ type }: { type: string }) => {
    const ucType = type.toUpperCase()
    if (ucType.includes('CLAS')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
            </div>
        )
    }
    if (ucType.includes('FUNC')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>
            </div>
        )
    }
    if (ucType.includes('PROG')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            </div>
        )
    }
    if (ucType.includes('VIEW')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
            </div>
        )
    }
    if (ucType.includes('INTF')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8Z" /><path d="M10 12h4" /><path d="M2 8h16" /><path d="M18 11h4" /><path d="M18 13h4" /></svg>
            </div>
        )
    }
    if (ucType.includes('TABL')) {
        return (
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M21 9H3" /><path d="M21 15H3" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
            </div>
        )
    }
    return (
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        </div>
    )
}

export default function CodeRepositoryPage() {
    const [sources, setSources] = useState<any[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)

    // OData Filter State
    const [entitySet, setEntitySet] = useState('ObjlistSet') // Default for this view
    const [filterQuery, setFilterQuery] = useState('')
    const [top, setTop] = useState('100')
    const [skip, setSkip] = useState('0')
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('All Types')
    const [packageFilter, setPackageFilter] = useState('')

    const [rawJsonResponse, setRawJsonResponse] = useState<any>(null)
    const [fetchedRecords, setFetchedRecords] = useState<any[]>([])
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
    const [previewRecord, setPreviewRecord] = useState<any>(null)
    const [isAdvising, setIsAdvising] = useState(false)
    const [showExplainPopup, setShowExplainPopup] = useState(false)
    const [explainResponse, setExplainResponse] = useState('')
    const [fetchedRawCode, setFetchedRawCode] = useState('')
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
    const [requestedUrl, setRequestedUrl] = useState<string>('')

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
            if (btpOnly.length > 0) {
                setSelectedSourceId(btpOnly[0].id)
            }
        } catch (err) {
            console.error('Failed to fetch sources:', err)
        }
    }

    const getServiceRoot = (url: string) => {
        if (!url) return ''
        let root = url.split('?')[0].replace(/\/$/, '')
        const sets = ['objectsSet', 'ObjlistSet', 'sourcecodeSet']
        for (const s of sets) {
            if (root.endsWith(`/${s}`)) {
                root = root.substring(0, root.length - s.length).replace(/\/$/, '')
            }
        }
        return root.endsWith('/') ? root : root + '/'
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
                    top: top, // Limit for better performance
                    skip: skip
                }
            })

            // Extract array of records
            let records: any[] = []
            if (Array.isArray(res.data.data)) records = res.data.data
            else if (res.data.data?.value && Array.isArray(res.data.data.value)) records = res.data.data.value
            else if (res.data.data?.d?.results && Array.isArray(res.data.data.d.results)) records = res.data.data.d.results
            // else if (res.data.data && typeof res.data.data === 'object' && res.data.data.Object) records = [res.data.data] // This line was removed as it's not in the new code

            // Map to standard table structure
            const sourceName = sources.find(s => s.id === selectedSourceId)?.name || 'Unknown'
            const savedTime = new Date().toLocaleString()
            const mappedRecords = records.map((r, i) => {
                const name = r.ObjectName || r.Objname || r.name || r.Object || r.Title || r.ID || `Item_${i}`
                const type = r.ObjectType || r.Objtype || r.type || r.Type || '-'
                const pkg = r.Package || r.Devclass || '-'
                const createdBy = r.Createby || r.Author || r.CreatedBy || '-'
                const desc = r.Objdesc || r.Description || r.title || 'No description available'
                const id = `${selectedSourceId}_${name}_${i}`
                return {
                    id,
                    name,
                    type,
                    package: pkg,
                    createdBy,
                    description: desc,
                    source: sourceName,
                    savedAt: savedTime,
                    rawData: r
                }
            })

            setFetchedRecords(mappedRecords)
            // setViewMode('table') // This line was removed as it's not in the new code
            setRawJsonResponse(res.data.data)
            setToastMessage({ text: `Found ${mappedRecords.length} objects.`, type: 'success' })
            setTimeout(() => setToastMessage(null), 3000)
        } catch (err: any) {
            console.error('Sync failed:', err)
            setToastMessage({ text: 'Failed to fetch BTP objects', type: 'error' })
            setTimeout(() => setToastMessage(null), 5000)
        } finally {
            setIsLoading(false)
        }
    }

    const handleExplainCode = async () => {
        setIsAdvising(true)
        setExplainResponse('')
        setShowExplainPopup(true)
        setFetchedRawCode('')
        setRequestedUrl('')

        try {
            const selectedItems = fetchedRecords.filter(r => selectedRecords.has(r.id))
            if (selectedItems.length === 0) {
                setExplainResponse('Please select at least one object to explain.')
                setIsAdvising(false)
                return
            }

            const codeContents: any[] = []
            const token = localStorage.getItem('mygo-token')

            for (const item of selectedItems) {
                // Determine the correct object name and type field from raw data
                // Patterns: ObjectName/ObjectType, Objname/Objtype, Object/Type
                const raw = item.rawData
                const objName = raw.ObjectName || raw.Objname || raw.Object || raw.name
                const objType = raw.ObjectType || raw.Objtype || raw.Type || raw.type || '-'
                
                if (!objName) continue

                try {
                    setToastMessage({ text: `Fetching source for ${objName}...`, type: 'success' })

                    // Construct the specific OData filter as requested
                    let filterQuery = `ObjectName eq '${objName}'`
                    if (objType && objType !== '-') {
                        filterQuery = `ObjectType eq '${objType}' and ObjectName eq '${objName}'`
                    }

                    // For UI visibility, construct what the expected final URL would look like
                    const source = sources.find(s => s.id === selectedSourceId)
                    const baseUrl = source?.config?.apiEndpoint || ''
                    const rootUrl = getServiceRoot(baseUrl)
                    const displayUrl = `${rootUrl}sourcecodeSet?$filter=${encodeURIComponent(filterQuery)}`
                    setRequestedUrl(displayUrl)

                    // Use POST as requested, passing params in body
                    const res = await axios.post(`/api/btp/${selectedSourceId}/fetch-code`, {
                        entity_set: 'sourcecodeSet',
                        filter_query: filterQuery,
                        top: '1000'
                    }, {
                        headers: {
                            Authorization: token ? `Bearer ${token}` : ''
                        }
                    })

                    // Get the exact raw JSON from the response
                    const responseData = res.data.data
                    codeContents.push({
                        object_name: objName,
                        object_type: objType,
                        raw_sourcecode_response: responseData
                    })

                } catch (fetchErr) {
                    console.error(`Failed to fetch code for ${objName}:`, fetchErr)
                }
            }

            if (codeContents.length === 0) {
                setExplainResponse('Could not retrieve source code for the selected object(s).')
                setIsAdvising(false)
                return
            }

            let rawJsonString = ''
            if (codeContents.length === 1) {
                rawJsonString = JSON.stringify(codeContents[0].raw_sourcecode_response, null, 2)
            } else {
                rawJsonString = JSON.stringify(codeContents, null, 2)
            }
            setFetchedRawCode(rawJsonString)

            setToastMessage({ text: `Analyzing with AI Advisor...`, type: 'success' })

            // Post the raw json directly to our explanation endpoint
            const aiRes = await axios.post('/api/explain-code', {
                code: rawJsonString,
                code_type: 'SAP ABAP (Raw JSON Metadata)',
                program_name: selectedItems.length === 1 ? selectedItems[0].name : 'Multiple Objects'
            })

            setExplainResponse(aiRes.data.explanation || 'No explanation generated.')
            setToastMessage({ text: `Analysis complete!`, type: 'success' })
            setTimeout(() => setToastMessage(null), 3000)
        } catch (err) {
            console.error(err)
            setExplainResponse('Failed to communicate with AI Agent.')
            setToastMessage({ text: 'AI agent error', type: 'error' })
            setTimeout(() => setToastMessage(null), 5000)
        } finally {
            setIsAdvising(false)
        }
    }

    const onAgentSelect = (agentId: string) => {
        if (agentId === 'code-explainer') {
            handleExplainCode()
        } else {
            setToastMessage({ text: `Agent '${agentId}' is not configured for this page yet.`, type: 'error' })
            setTimeout(() => setToastMessage(null), 3000)
        }
    }

    const filteredRecords = fetchedRecords.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             r.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = typeFilter === 'All Types' || r.type === typeFilter
        const matchesPackage = !packageFilter || r.package.toLowerCase().includes(packageFilter.toLowerCase())
        return matchesSearch && matchesType && matchesPackage
    })

    const toggleSelectAll = () => {
        if (selectedRecords.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedRecords(new Set())
        } else {
            setSelectedRecords(new Set(filteredRecords.map(r => r.id)))
        }
    }

    const toggleRecord = (id: string) => {
        const next = new Set(selectedRecords)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedRecords(next)
    }

    return (
        <div className="doc-hub-page scrollbar-hide">
            {/* Page Header */}
            <div className="doc-hub-header">
                <div className="doc-hub-header-left">
                    <div className="doc-hub-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="doc-hub-title">Custom SAP Development Objects</h1>
                        <p className="doc-hub-subtitle">
                            Package: <span className="text-emerald-600 font-semibold">{packageFilter || 'All'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="top-header-btn bg-white border border-slate-200" onClick={handleSync} disabled={isLoading}>
                        <svg className={isLoading ? 'animate-spin' : ''} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                    </button>
                    <button className="top-header-btn bg-white border border-slate-200" onClick={() => setViewMode(viewMode === 'table' ? 'json' : 'table')}>
                        <span className="text-xs font-bold uppercase">{viewMode === 'table' ? '{}' : 'T'}</span>
                    </button>
                    <AIAgentsDropdown onAgentSelect={onAgentSelect} />
                </div>
            </div>

            {/* OData Configuration Panel (Same as previous flow) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        OData Request Configuration
                    </h2>
                    <div className="flex gap-2">
                        <button 
                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'table' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => setViewMode('table')}
                        >
                            TABLE
                        </button>
                        <button 
                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'json' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => setViewMode('json')}
                        >
                            RAW JSON
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BTP Source</label>
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                            value={selectedSourceId}
                            onChange={(e) => setSelectedSourceId(e.target.value)}
                        >
                            <option value="">Select BTP Source</option>
                            {sources.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entity Set</label>
                        <input 
                            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                            placeholder="e.g. ObjlistSet"
                            value={entitySet}
                            onChange={(e) => setEntitySet(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OData $filter</label>
                        <input 
                            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                            placeholder="e.g. ObjectType eq 'CLAS'"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">$top (limit)</label>
                        <input 
                            type="number"
                            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                            value={top}
                            onChange={(e) => setTop(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">$skip (offset)</label>
                        <input 
                            type="number"
                            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                            value={skip}
                            onChange={(e) => setSkip(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Local Search & Table Filters bar */}
            <div className="doc-hub-filters">
                <div className="doc-hub-filter-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>LOCAL RESULTS FILTER</span>
                </div>
                
                <select 
                    className="doc-hub-filter-select" 
                    value={typeFilter} 
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    <option value="All Types">Object Type</option>
                    {Array.from(new Set(fetchedRecords.map(r => r.type))).sort().map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Package (Local Search)"
                        className="doc-hub-filter-select pr-4"
                        value={packageFilter}
                        onChange={(e) => setPackageFilter(e.target.value)}
                    />
                </div>

                <div className="relative flex-1 max-w-md ml-4">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Search in current results..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <p className="doc-hub-count mb-4">
                <span className="doc-hub-count-num">{filteredRecords.length}</span> objects found
            </p>

            {/* Content Area */}
            <div className="doc-hub-table-wrapper">
                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center bg-white">
                        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 rounded-full border-t-transparent mb-4"></div>
                        <p className="text-slate-500 font-medium tracking-tight">Accessing SAP BTP Code Repository...</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <table className="doc-hub-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40, textAlign: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={filteredRecords.length > 0 && selectedRecords.size === filteredRecords.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                </th>
                                <th>OBJECT NAME</th>
                                <th>TYPE</th>
                                <th>DESCRIPTION</th>
                                <th>PACKAGE</th>
                                <th>CREATED BY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((record) => (
                                <tr key={record.id} className={selectedRecords.has(record.id) ? 'bg-emerald-50/30' : ''}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedRecords.has(record.id)}
                                            onChange={() => toggleRecord(record.id)}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </td>
                                    <td>
                                        <button 
                                            onClick={() => setPreviewRecord(record)}
                                            className="font-bold text-slate-800 hover:text-emerald-600 transition-colors tracking-tight"
                                        >
                                            {record.name}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <TypeIcon type={record.type} />
                                            <span className="text-slate-500 whitespace-nowrap">{record.type}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="max-w-xs truncate text-slate-500 italic" title={record.description}>
                                            {record.description}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-mono uppercase">
                                            {record.package}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                {record.createdBy.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-slate-600">{record.createdBy}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-400 italic">
                                        No objects match the current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <div className="bg-slate-900 p-6 overflow-auto" style={{ maxHeight: '70vh' }}>
                        <pre className="text-emerald-400 text-xs font-mono">{JSON.stringify(rawJsonResponse, null, 2)}</pre>
                    </div>
                )}
            </div>

            {/* Explain Popup - Premium AI View */}
            {showExplainPopup && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={() => setShowExplainPopup(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                </div>
                                <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">AI Advisor: Code Insights</h3>
                            </div>
                            <button onClick={() => setShowExplainPopup(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/50 p-8 flex flex-col gap-8 scrollbar-hide">
                            {/* Requested URL & Raw Source (Visible for testing) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                                {requestedUrl && (
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 
                                            Target BTP Endpoint
                                        </p>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <p className="text-[11px] font-mono text-slate-600 break-all">{requestedUrl}</p>
                                        </div>
                                    </div>
                                )}
                                {fetchedRawCode && (
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 
                                            Raw Data Context
                                        </p>
                                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                            <pre className="text-[10px] font-mono text-emerald-400 max-h-20 overflow-auto scrollbar-hide">
                                                {fetchedRawCode}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Main Explanation Block */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex-1 min-h-[400px]">
                                {isAdvising ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-4 border-slate-100 animate-pulse"></div>
                                            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                                        </div>
                                        <p className="text-slate-600 font-semibold text-lg animate-pulse">Deep analysis in progress...</p>
                                        <p className="text-slate-400 text-sm">Processing SAP metadata and logic flows</p>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                            </div>
                                            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">AI Agent Explanation</h4>
                                        </div>
                                        
                                        <div 
                                            className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap font-sans space-y-4"
                                            style={{ letterSpacing: '-0.011em' }}
                                        >
                                            {explainResponse}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[11px] text-slate-400 font-medium">This analysis is AI-generated and should be verified for mission-critical decisions.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewRecord && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewRecord(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <TypeIcon type={previewRecord.type} />
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 leading-none mb-1">{previewRecord.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Metadata Insight</p>
                                </div>
                            </div>
                            <button onClick={() => setPreviewRecord(null)} className="text-slate-400 hover:text-slate-700">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-0 overflow-auto flex-1 bg-slate-50">
                            <div className="p-8">
                                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                                    <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">raw_metada_payload.json</span>
                                    </div>
                                    <pre className="p-6 text-sm font-mono text-emerald-400 leading-relaxed overflow-x-auto">
                                        {JSON.stringify(previewRecord.rawData, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '0.75rem 1.5rem', borderRadius: '12px', color: 'white', fontWeight: 600, background: toastMessage.type === 'success' ? '#059669' : '#dc2626', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', animation: 'slideUp 0.3s ease-out' }}>
                    {toastMessage.text}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />
        </div>
    )
}
