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
    const [entitySet, setEntitySet] = useState('') // Blank by default as requested
    const [filterQuery, setFilterQuery] = useState('')
    const [top, setTop] = useState('100')
    const [skip, setSkip] = useState('0')
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('All Types')
    const [packageFilter, setPackageFilter] = useState('')

    const [rawJsonResponse, setRawJsonResponse] = useState<any>(null)
    const [fetchedRecords, setFetchedRecords] = useState<any[]>([])
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
    const [isAdvising, setIsAdvising] = useState(false)
    const [showExplainPopup, setShowExplainPopup] = useState(false)
    const [explainResponse, setExplainResponse] = useState('')
    const [fetchedRawCode, setFetchedRawCode] = useState('')
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
    const [requestedUrl, setRequestedUrl] = useState<string>('')
    const [activeAgentId, setActiveAgentId] = useState<string>('')

    // Toast State
    const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    // Cloud ALM push state
    const [almUploadStep, setAlmUploadStep] = useState<'idle' | 'form' | 'uploading' | 'success' | 'error'>('idle')
    const [almSources, setAlmSources] = useState<any[]>([])
    const [almSelectedSource, setAlmSelectedSource] = useState('')
    const [almProjects, setAlmProjects] = useState<any[]>([])
    const [almSelectedProject, setAlmSelectedProject] = useState('')
    const [almDocName, setAlmDocName] = useState('')
    const [almLoadingStep, setAlmLoadingStep] = useState('')
    const [almError, setAlmError] = useState('')
    const [almSuccessDoc, setAlmSuccessDoc] = useState<any>(null)

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

    const handleAgentAction = async (agentId: string) => {
        setIsAdvising(true)
        setExplainResponse('')
        setShowExplainPopup(true)
        setFetchedRawCode('')
        setRequestedUrl('')
        setActiveAgentId(agentId)
        resetAlmUpload() // Reset CALM state when starting a new action

        try {
            const selectedItems = fetchedRecords.filter(r => selectedRecords.has(r.id))
            if (selectedItems.length === 0) {
                setExplainResponse('Please select at least one object to process.')
                setIsAdvising(false)
                return
            }

            const codeContents: any[] = []
            const token = localStorage.getItem('mygo-token')

            for (const item of selectedItems) {
                const raw = item.rawData
                const objName = raw.ObjectName || raw.Objname || raw.Object || raw.name
                const objType = raw.ObjectType || raw.Objtype || raw.Type || raw.type || '-'
                
                if (!objName) continue

                try {
                    setToastMessage({ text: `Fetching source for ${objName}...`, type: 'success' })

                    let filterQuery = `ObjectName eq '${objName}'`
                    if (objType && objType !== '-') {
                        filterQuery = `ObjectType eq '${objType}' and ObjectName eq '${objName}'`
                    }

                    const source = sources.find(s => s.id === selectedSourceId)
                    const baseUrl = source?.config?.apiEndpoint || ''
                    const rootUrl = getServiceRoot(baseUrl)
                    const displayUrl = `${rootUrl}sourcecodeSet?$filter=${encodeURIComponent(filterQuery)}`
                    setRequestedUrl(displayUrl)

                    const res = await axios.post(`/api/btp/${selectedSourceId}/fetch-code`, {
                        entity_set: 'sourcecodeSet',
                        filter_query: filterQuery,
                        top: '1000'
                    }, {
                        headers: {
                            Authorization: token ? `Bearer ${token}` : ''
                        }
                    })

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

            setToastMessage({ text: `Running AI Agent...`, type: 'success' })

            // Determine endpoint and payload based on agentId
            let endpoint = '/api/explain-code'
            let payload: any = {
                code: rawJsonString,
                code_type: 'SAP ABAP (Raw JSON Metadata)',
                program_name: selectedItems.length === 1 ? selectedItems[0].name : 'Multiple Objects'
            }

            if (agentId === 'spec-assistant') {
                endpoint = '/api/generate-spec'
                payload = { 
                    requirements: `ABAP Object Metadata:\n${rawJsonString}`,
                    type: 'technical',
                    format: 'preview'
                }
            } else if (agentId === 'test-case-generator') {
                endpoint = '/api/generate-test-cases'
                payload = {
                    code: rawJsonString,
                    test_type: 'manual',
                    format: 'preview'
                }
            } else if (agentId === 'solution-advisor') {
                endpoint = '/api/analyze-code'
                payload = {
                    code: rawJsonString,
                    code_type: 'ABAP'
                }
            } else if (agentId === 'prompt-generator') {
                endpoint = '/api/generate-prompt'
                payload = {
                    language: 'ABAP',
                    task: 'Improve or understand this code',
                    context: rawJsonString
                }
            } else if (agentId === 'ask-yoda') {
                endpoint = '/api/ask-yoda'
                payload = {
                    question: 'Analyze this SAP object and explain its business implications and technical logic in a clear way.',
                    context: rawJsonString
                }
            }

            const aiRes = await axios.post(endpoint, payload)
            
            // Format response if specialized
            let finalOutput = ''
            if (agentId === 'solution-advisor') {
                const data = aiRes.data
                finalOutput = `## Code Analysis & Recommendations\n\n### Anti-Patterns Found\n`
                if (data.anti_patterns?.length) {
                    data.anti_patterns.forEach((ap: any) => {
                        finalOutput += `- **${ap.pattern}** (${ap.severity}): ${ap.description}\n  *Suggestion: ${ap.suggestion}*\n`
                    })
                } else finalOutput += "_No obvious anti-patterns detected._\n"

                finalOutput += `\n### Suggested Improvements\n`
                if (data.suggestions?.length) {
                    data.suggestions.forEach((s: any) => {
                        finalOutput += `#### ${s.type}\n- **Reason**: ${s.reason}\n- **Suggested**: \`${s.suggested}\`\n`
                    })
                }

                finalOutput += `\n### Strategic Roadmap\n`
                if (data.improvements?.length) {
                    data.improvements.forEach((i: any) => {
                        finalOutput += `- [${i.priority}] **${i.category}**: ${i.description}\n`
                    })
                }
            } else if (agentId === 'test-case-generator') {
                finalOutput = aiRes.data.test_cases || aiRes.data.explanation || 'No test cases generated.'
            } else if (agentId === 'spec-assistant') {
                finalOutput = aiRes.data.spec || aiRes.data.explanation || 'No spec generated.'
            } else if (agentId === 'prompt-generator') {
                finalOutput = `### Optimized System Prompt\n\n${aiRes.data.prompt}`
            } else if (agentId === 'ask-yoda') {
                finalOutput = aiRes.data.answer || aiRes.data.explanation || 'Yoda has no answer today.'
            } else {
                finalOutput = aiRes.data.explanation || aiRes.data.answer || JSON.stringify(aiRes.data, null, 2)
            }

            setExplainResponse(finalOutput)
            setToastMessage({ text: `Task complete!`, type: 'success' })
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
        if (agentId === 'sync-documents') {
            handleSync()
            return
        }
        handleAgentAction(agentId)
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

    // Cloud ALM Integration Functions
    const handleOpenAlmUpload = async () => {
        setAlmUploadStep('form')
        setAlmError('')
        setAlmDocName(`${activeAgentId === 'spec-assistant' ? 'Technical' : 'AI'} Specification - ${new Date().toLocaleDateString()}`)
        setAlmLoadingStep('sources')
        try {
            const res = await axios.get('/api/sources')
            const calmSources = (res.data.sources || []).filter((s: any) => s.type === 'CALM')
            setAlmSources(calmSources)
            if (calmSources.length === 1) {
                setAlmSelectedSource(calmSources[0].id)
                await loadAlmProjects(calmSources[0].id)
            }
        } catch {
            setAlmError('Failed to load Cloud ALM sources.')
        } finally {
            setAlmLoadingStep('')
        }
    }

    const loadAlmProjects = async (sourceId: string) => {
        setAlmLoadingStep('projects')
        setAlmProjects([])
        setAlmSelectedProject('')
        try {
            const res = await axios.get(`/api/calm/${sourceId}/projects`)
            setAlmProjects(res.data.projects || [])
        } catch {
            setAlmError('Failed to load projects.')
        } finally {
            setAlmLoadingStep('')
        }
    }

    const handleAlmUpload = async () => {
        if (!almSelectedSource || !almSelectedProject || !almDocName.trim()) return
        setAlmUploadStep('uploading')
        setAlmError('')
        try {
            await axios.post(`/api/calm/${almSelectedSource}/push-spec`, {
                name: almDocName.trim(),
                content: explainResponse,
                projectId: almSelectedProject,
                documentType: 'technical_spec'
            })
            setAlmSuccessDoc({ name: almDocName.trim() })
            setAlmUploadStep('success')
        } catch (err: any) {
            setAlmError(err?.response?.data?.error || 'Failed to upload to Cloud ALM.')
            setAlmUploadStep('error')
        }
    }

    const resetAlmUpload = () => {
        setAlmUploadStep('idle')
        setAlmSources([])
        setAlmSelectedSource('')
        setAlmProjects([])
        setAlmSelectedProject('')
        setAlmDocName('')
        setAlmError('')
        setAlmSuccessDoc(null)
        setAlmLoadingStep('')
    }

    return (
        <div className="doc-hub-page scrollbar-hide">
            {/* Page Header - BEAUTIFIED & STICKY */}
            <div className="doc-hub-header sticky top-0 z-40 bg-[#f8fafc]/95 backdrop-blur-md border-b border-slate-200 px-10 py-5 -mx-10 -mt-8 mb-8 flex items-center justify-between transition-all duration-300">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-100 shadow-sm">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-[#034354] tracking-tight leading-none mb-1">SAP BTP Code Repository</h1>
                        <div className="flex items-center gap-2">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[13px] font-medium text-slate-500">
                                Source: <span className="text-emerald-700 font-bold">{sources.find(s => s.id === selectedSourceId)?.name || 'Not Selected'}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl font-bold text-[13px] transition-all shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 active:scale-95 disabled:opacity-50" 
                        onClick={handleSync} 
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                            </svg>
                        )}
                        FETCH CODE
                    </button>
                    <button 
                        className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all hover:shadow-sm" 
                        title="Toggle View Mode" 
                        onClick={() => setViewMode(viewMode === 'table' ? 'json' : 'table')}
                    >
                        <span className="text-[11px] font-black uppercase tracking-tighter">{viewMode === 'table' ? '{...}' : 'T'}</span>
                    </button>
                    <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
                    <AIAgentsDropdown onAgentSelect={onAgentSelect} />
                </div>
            </div>

            {/* Combined Filter Bar - PREMIUM MINIMAL TOOLBAR */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">BTP SOURCE</label>
                    <select 
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#034354] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-40 cursor-pointer"
                        value={selectedSourceId}
                        onChange={(e) => setSelectedSourceId(e.target.value)}
                    >
                        <option value="">Select Instance</option>
                        {sources.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">ENTITY SET</label>
                    <input 
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#034354] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-32"
                        placeholder="ObjlistSet"
                        value={entitySet}
                        onChange={(e) => setEntitySet(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">ODATA FILTER</label>
                    <div className="relative w-full">
                        <input 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            placeholder="e.g. ObjectType eq 'CLAS'"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">TOP</span>
                        <input 
                            type="number"
                            className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-16"
                            value={top}
                            onChange={(e) => setTop(e.target.value)}
                        />
                    </div>
                </div>

                <div className="h-6 w-[1px] bg-slate-100 mx-1 hidden lg:block"></div>

                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">LOCAL</label>
                    <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                        <div className="pl-3 text-slate-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <input 
                            type="text"
                            className="bg-transparent border-none py-2 px-3 text-xs outline-none w-40"
                            placeholder="Search current..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
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
                                        <span className="font-bold text-slate-800 tracking-tight">
                                            {record.name}
                                        </span>
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
                                <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">
                                    {activeAgentId === 'spec-assistant' ? 'AI Spec Agent: Technical Design' :
                                     activeAgentId === 'test-case-generator' ? 'AI Test Agent: Manual Scenarios' :
                                     activeAgentId === 'solution-advisor' ? 'AI Advisor: SAP Best Practices' :
                                     activeAgentId === 'ask-yoda' ? 'Ask Yoda: Expert Insights' :
                                     activeAgentId === 'prompt-generator' ? 'AI Prompt: Prompt Refinement' :
                                     'AI Advisor: Code Insights'}
                                </h3>
                            </div>
                            <button onClick={() => setShowExplainPopup(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/50 p-8 flex flex-col gap-6 scrollbar-hide">
                            {/* Push to Cloud ALM Panel (Only for Spec Assistant) */}
                            {activeAgentId === 'spec-assistant' && !isAdvising && explainResponse && (
                                <div className="max-w-4xl mx-auto w-full">
                                    {almUploadStep === 'idle' ? (
                                        <button
                                            onClick={handleOpenAlmUpload}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 border-emerald-500/20 bg-emerald-50 hov:bg-emerald-100 text-emerald-700 transition-all text-sm font-bold shadow-sm"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            PUSH SPEC TO SAP CLOUD ALM
                                        </button>
                                    ) : (
                                        <div className="bg-white border-2 border-emerald-100 rounded-2xl shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-300">
                                            <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex justify-between items-center">
                                                <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-2">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                    Push to Cloud ALM
                                                </h4>
                                                <button onClick={resetAlmUpload} className="text-emerald-400 hover:text-emerald-600 font-bold p-1">✕</button>
                                            </div>
                                            
                                            <div className="p-6">
                                                {almUploadStep === 'uploading' ? (
                                                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                                                        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 rounded-full border-t-transparent"></div>
                                                        <span className="text-sm font-medium text-slate-600">Pushing specification to CALM...</span>
                                                    </div>
                                                ) : almUploadStep === 'success' ? (
                                                    <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl shadow-inner">✓</div>
                                                        <p className="text-emerald-800 font-bold">Success!</p>
                                                        <p className="text-slate-500 text-sm">Specification has been successfully pushed to Cloud ALM.</p>
                                                        <button onClick={resetAlmUpload} className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-bold transition-all">CLOSE PANEL</button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {almError && (
                                                            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                                                                {almError}
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Document Name</label>
                                                                <input 
                                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                                    value={almDocName}
                                                                    onChange={e => setAlmDocName(e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Target Project</label>
                                                                <select 
                                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                                                                    value={almSelectedProject}
                                                                    onChange={e => setAlmSelectedProject(e.target.value)}
                                                                    disabled={almLoadingStep === 'projects'}
                                                                >
                                                                    <option value="">Select CALM Project...</option>
                                                                    {almProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {almSources.length > 1 && (
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">CALM Instance</label>
                                                                <select 
                                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                                                                    value={almSelectedSource}
                                                                    onChange={e => {
                                                                        setAlmSelectedSource(e.target.value)
                                                                        if (e.target.value) loadAlmProjects(e.target.value)
                                                                    }}
                                                                >
                                                                    <option value="">Select Instance...</option>
                                                                    {almSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                </select>
                                                            </div>
                                                        )}

                                                        <button 
                                                            onClick={handleAlmUpload}
                                                            disabled={!almSelectedProject || !almDocName.trim() || !!almLoadingStep}
                                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-widest transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 mt-2"
                                                        >
                                                            PUSH TO CLOUD ALM
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
