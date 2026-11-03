'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import GlobalAIAgentsDropdown from '@/components/GlobalAIAgentsDropdown'
import SyncCodeModal from '@/components/modals/SyncCodeModal'
import { usePageHeader } from '@/context/PageHeaderContext'
import { htmlToPlainText, escapeHtml } from '@/lib/htmlText'

interface CodeItem {
    id: string
    name: string
    type: string
    source: string
    project: string
    updatedBy: string
    updatedOn: string
    updatedAt: number
    webUrl?: string
    documentId?: string
    documentTypeCode?: string
}

interface PaginationMeta {
    total: number
    page: number
    page_size: number
    total_pages: number
}

const PAGE_SIZE = 10

const sourceColors: Record<string, { bg: string; text: string }> = {
    SAP_ADT: { bg: '#e0e7ff', text: '#3730a3' },
    SAP_ADT_MCP: { bg: '#e0e7ff', text: '#3730a3' },
    'SAP ADT': { bg: '#e0e7ff', text: '#3730a3' },
    BTP: { bg: '#dcfce7', text: '#166534' },
    CALM: { bg: '#dbeafe', text: '#1e40af' },
    SharePoint: { bg: '#d1fae5', text: '#065f46' },
    Git: { bg: '#ffedd5', text: '#9a3412' },
}

const codeTypeNames: Record<string, string> = {
    CLAS: 'ABAP Class',
    INTF: 'ABAP Interface',
    PROG: 'ABAP Program',
    INCL: 'ABAP Include',
    FUGR: 'Function Group',
    FUNC: 'Function Module',
    DDLS: 'CDS View',
    TABL: 'Database Table',
    VIEW: 'Database View',
    DTEL: 'Data Element',
    DOMA: 'Domain',
    MSAG: 'Message Class',
    SRVD: 'Service Definition',
    SRVB: 'Service Binding',
    BDEF: 'Behavior Definition',
    DEVC: 'Package',
    IWMO: 'Gateway Model',
    IWSG: 'Gateway Service',
    IWVB: 'Gateway Vocabulary',
    IWPR: 'Gateway Project',
    WDCC: 'Web Dynpro Component',
    SXCI: 'BAdI Implementation',
    STOB: 'Structured Object',
    LRCC: 'ABAP Core Component',
    OA2S: 'OAuth 2.0 Scope',
    IWOM: 'Gateway OData Mapping',
}

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CodeHubPage() {
    const [codeItems, setCodeItems] = useState<CodeItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, page: 1, page_size: PAGE_SIZE, total_pages: 1 })

    // Server-side filters
    const [search, setSearch] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [projectFilter, setProjectFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    // Direct Directory Fetch State (BTP / SAP ADT)
    const [availableSources, setAvailableSources] = useState<any[]>([])
    const [selectedDirectorySource, setSelectedDirectorySource] = useState('')
    const [directoryTarget, setDirectoryTarget] = useState('$TMP')
    const [availablePackages, setAvailablePackages] = useState<string[]>([
        '$TMP', 'Z*', 'ZDEV', 'ZABAPGIT_STAND_GG', 'ZABAP_MCP', 'Z001', 'ZFIORI', 'ZEWM_RAP', 'ZAPI', 'ZCDS'
    ])
    const [isFetchingDirectory, setIsFetchingDirectory] = useState(false)
    const [isLiveDirectoryMode, setIsLiveDirectoryMode] = useState(false)

    // Filter option lists
    const [sourceOptions, setSourceOptions] = useState<string[]>([])
    const [typeOptions, setTypeOptions] = useState<string[]>([])
    const [projectOptions, setProjectOptions] = useState<string[]>([])
    const optionsLoaded = useRef(false)

    const [showSyncModal, setShowSyncModal] = useState(false)
    const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set())
    const [selectedRadioCodeId, setSelectedRadioCodeId] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Code Viewer Modal State
    const [viewerCode, setViewerCode] = useState<{ name: string; rawCode: string; formattedHtml: string; type: string } | null>(null)
    const [isLoadingCodeContent, setIsLoadingCodeContent] = useState(false)
    const [copiedSuccess, setCopiedSuccess] = useState(false)

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchCodeItems = useCallback(async (page: number = 1) => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', String(page))
            params.set('page_size', String(PAGE_SIZE))
            params.set('category', 'code')
            if (search) params.set('search', search)
            if (sourceFilter) params.set('source', sourceFilter)
            if (typeFilter) params.set('type', typeFilter)
            if (projectFilter) params.set('project', projectFilter)
            if (dateFrom) params.set('date_from', dateFrom)
            if (dateTo) params.set('date_to', dateTo)

            const res = await axios.get(`/api/documents?${params.toString()}`)
            const { documents: rawDocs, total, total_pages, page: pg, page_size } = res.data

            const mappedItems: CodeItem[] = (rawDocs ?? []).map((doc: any) => {
                const docId = doc.documentId || doc.document_id || doc.uuid || doc.id || doc.name || doc.filename
                let rawName = doc.title || doc.name || doc.metadata?.name || doc.filename || ''
                let docTypeCode = doc.documentTypeCode || doc.type || doc.doc_type || doc.metadata?.documentType || 'CLAS'
                
                // Extract code type from parentheses e.g. "Z001 (DEVC)" if type is generic or empty
                const typeMatch = rawName.match(/\(([A-Z0-9_]{2,6})\)$/)
                if (typeMatch) {
                    if (docTypeCode === 'Document' || !docTypeCode) {
                        docTypeCode = typeMatch[1]
                    }
                }
                const docType = codeTypeNames[docTypeCode] || docTypeCode
                const rawDate = doc.modifiedAt || doc.updatedOn || doc.metadata?.updatedAt || doc.metadata?.modifiedAt || null
                const parsedTs = rawDate ? new Date(rawDate).getTime() : NaN
                const resolvedUpdatedBy = doc.updatedBy || doc.changedBy || doc.lastChangedBy || doc.modifiedBy || doc.metadata?.updatedBy || doc.metadata?.changedBy || null
                return {
                    id: docId,
                    name: rawName,
                    type: docType,
                    source: doc.source || doc.metadata?.source || 'SAP_ADT',
                    project: doc.project || doc.metadata?.project || '$TMP',
                    updatedBy: resolvedUpdatedBy || 'System',
                    updatedOn: formatDate(rawDate),
                    updatedAt: isNaN(parsedTs) ? 0 : parsedTs,
                    webUrl: doc.webUrl || doc.metadata?.webUrl,
                    documentId: docId,
                    documentTypeCode: docTypeCode
                }
            })

            setCodeItems(mappedItems)
            setPagination({ total: total ?? 0, page: pg ?? page, page_size: page_size ?? PAGE_SIZE, total_pages: total_pages ?? 1 })
            setCurrentPage(pg ?? page)
        } catch (err) {
            console.error('Failed to fetch code items:', err)
        } finally {
            setIsLoading(false)
        }
    }, [search, sourceFilter, typeFilter, projectFilter, dateFrom, dateTo])

    // Load sources for directory fetch & filter options once on mount
    useEffect(() => {
        axios.get('/api/sources').then(res => {
            const all = res.data?.sources || []
            const codeSources = all.filter((s: any) => {
                const t = String(s.type || '').toUpperCase()
                return t === 'SAP_ADT' || t === 'SAP_ADT_MCP' || t === 'BTP'
            })
            setAvailableSources(codeSources)
            if (codeSources.length > 0) {
                const firstSource = codeSources[0]
                setSelectedDirectorySource(firstSource.id)
                const isBtp = firstSource.type === 'BTP'
                setDirectoryTarget(isBtp ? 'ObjlistSet' : '$TMP')

                if (!isBtp) {
                    axios.get(`/api/calm/${firstSource.id}/projects`).then(pres => {
                        const pkgs = pres.data?.projects || []
                        if (pkgs.length > 0) {
                            setAvailablePackages(pkgs.map((p: any) => p.id || p.name))
                        }
                    }).catch(() => {})
                }
            }
        }).catch(() => {})

        if (optionsLoaded.current) return
        optionsLoaded.current = true
        // Backend caps page_size at 100
        axios.get('/api/documents?page=1&page_size=100&category=code').then(res => {
            const docs: any[] = res.data.documents ?? []
            setSourceOptions(Array.from(new Set<string>(docs.map(d => d.source).filter(Boolean))).sort())
            setTypeOptions(Array.from(new Set<string>(docs.map(d => d.type || d.doc_type).filter(Boolean))).sort())
            setProjectOptions(Array.from(new Set<string>(docs.map(d => d.project).filter(p => p && p !== 'N/A'))).sort())
        }).catch(() => {})
    }, [])

    const handleDirectorySourceChange = (srcId: string) => {
        setSelectedDirectorySource(srcId)
        const chosen = availableSources.find(s => s.id === srcId)
        if (chosen?.type === 'BTP') {
            setDirectoryTarget('ObjlistSet')
        } else {
            setDirectoryTarget('$TMP')
            axios.get(`/api/calm/${srcId}/projects`).then(pres => {
                const pkgs = pres.data?.projects || []
                if (pkgs.length > 0) {
                    setAvailablePackages(pkgs.map((p: any) => p.id || p.name))
                }
            }).catch(() => {})
        }
    }

    const handleFetchFromDirectory = async () => {
        if (!selectedDirectorySource) return
        setIsFetchingDirectory(true)
        try {
            const chosen = availableSources.find(s => s.id === selectedDirectorySource)
            const isBtp = chosen?.type === 'BTP'
            const token = typeof window !== 'undefined' ? (localStorage.getItem('mygo-token') || localStorage.getItem('token') || '') : ''
            const headers: Record<string, string> = {}
            if (token) headers['Authorization'] = `Bearer ${token}`
            // Route SAP calls to the selected source instead of the first configured one
            headers['X-Source-Id'] = selectedDirectorySource

            if (isBtp) {
                // Fetch using BTP pattern (from git trace: ObjlistSet with Objtype filter and package)
                // CatalogService.ObjlistSet: Objname / Objtype / Package / Objdesc / Createby.
                // The service rejects startswith()/contains(), so wildcards are matched client-side.
                const target = (directoryTarget || '').trim().toUpperCase()
                const isWildcard = target.includes('*')
                const filterParts = ["(Objtype eq 'PROG' or Objtype eq 'FUGR' or Objtype eq 'CLAS')"]
                if (target && !isWildcard && target !== 'OBJECTSSET' && target !== 'OBJLISTSET') {
                    filterParts.push(`Package eq '${target.replace(/'/g, "''")}'`)
                }

                const res = await axios.get(`/api/btp/${selectedDirectorySource}/fetch-code`, {
                    params: {
                        entity_set: 'ObjlistSet',
                        filter_query: filterParts.join(' and '),
                        // Without a Package filter the BTP service times out above ~100 rows
                        top: (isWildcard || !filterParts[1]) ? 100 : 1000
                    },
                    headers
                })
                const bData = res.data?.data
                let records: any[] = Array.isArray(bData) ? bData : (bData?.value || bData?.d?.results || [])
                if (isWildcard) {
                    const re = new RegExp('^' + target.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
                    records = records.filter(r => re.test(String(r.Objname || '').toUpperCase()) || re.test(String(r.Package || '').toUpperCase()))
                }

                const mapped: CodeItem[] = records.map((r, i) => {
                    const objName = r.Objname || r.ObjectName || r.name || r.Object || r.Title || `Item_${i}`
                    const objType = (r.Objtype || r.ObjectType || r.type || r.Type || 'PROG').toUpperCase()
                    // Lastupdated is YYYYMMDD
                    const lu = String(r.Lastupdated || '')
                    const luDate = /^\d{8}$/.test(lu) ? new Date(`${lu.slice(0, 4)}-${lu.slice(4, 6)}-${lu.slice(6, 8)}`) : null
                    return {
                        id: `BTP_${selectedDirectorySource}_${objName}_${i}`,
                        name: objName,
                        type: codeTypeNames[objType] || objType,
                        source: chosen?.name || 'BTP',
                        project: r.Package || directoryTarget || 'ObjlistSet',
                        updatedBy: r.Createby || r.Author || 'BTP OData',
                        updatedOn: luDate ? formatDate(luDate.toISOString()) : 'N/A',
                        updatedAt: luDate ? luDate.getTime() : 0,
                        documentId: `BTP_${selectedDirectorySource}_${objName}`,
                        documentTypeCode: objType
                    }
                })
                setCodeItems(mapped)
                setPagination({ total: mapped.length, page: 1, page_size: mapped.length, total_pages: 1 })
                setIsLiveDirectoryMode(true)
                setToastMessage({ text: `Fetched ${mapped.length} code objects from BTP directory`, type: 'success' })
            } else {
                // Fetch directly from live SAP ADT MCP endpoint (never fetch from CALM documents)
                const targetPkg = (directoryTarget || '$TMP').trim().toUpperCase()
                let objects: any[] = []

                if (targetPkg.includes('*')) {
                    // Wildcard search across SAP repository via ADT quickSearch
                    const searchRes = await axios.get(`/api/sap/adt/search`, {
                        params: { query: targetPkg, maxResults: 100 },
                        headers
                    })
                    objects = searchRes.data?.objects || []
                } else {
                    try {
                        const pkgRes = await axios.get(`/api/sap/adt/packages/${encodeURIComponent(targetPkg)}`, { headers })
                        if (pkgRes.data?.success && Array.isArray(pkgRes.data?.objects)) {
                            objects = pkgRes.data.objects
                        } else if (Array.isArray(pkgRes.data)) {
                            objects = pkgRes.data
                        }
                    } catch (pkgErr: any) {
                        // Fallback to quickSearch with package prefix
                        try {
                            const searchRes = await axios.get(`/api/sap/adt/search`, {
                                params: { query: `${targetPkg}*`, maxResults: 100 },
                                headers
                            })
                            objects = searchRes.data?.objects || []
                        } catch {}
                    }

                    // Secondary fallback if package returned 0 items
                    if (objects.length === 0) {
                        try {
                            const searchRes = await axios.get(`/api/sap/adt/search`, {
                                params: { query: `${targetPkg}*`, maxResults: 100 },
                                headers
                            })
                            objects = searchRes.data?.objects || []
                        } catch {}
                    }
                }

                const mapped: CodeItem[] = objects.map((obj: any, i: number) => {
                    const objName = obj.name || obj.ObjectName || obj.Objname || `Item_${i}`
                    const rawType = (obj.type || obj.ObjectType || obj.Objtype || 'CLAS').toUpperCase()
                    const typeLabel = codeTypeNames[rawType] || rawType
                    return {
                        id: `ADT_${selectedDirectorySource}_${objName}_${i}`,
                        name: objName,
                        type: typeLabel,
                        source: chosen?.name || 'SAP ADT MCP',
                        project: targetPkg,
                        updatedBy: 'SAP S/4HANA (ADT MCP)',
                        updatedOn: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
                        updatedAt: Date.now(),
                        documentId: `ADT_${objName}`,
                        documentTypeCode: rawType
                    }
                })

                setCodeItems(mapped)
                setPagination({ total: mapped.length, page: 1, page_size: mapped.length, total_pages: 1 })
                setIsLiveDirectoryMode(true)
                setToastMessage({ text: `Fetched ${mapped.length} live code objects from SAP ADT for "${targetPkg}"`, type: 'success' })
            }
            setTimeout(() => setToastMessage(null), 4000)
        } catch (err: any) {
            console.error('Directory fetch failed:', err)
            setToastMessage({ text: err?.response?.data?.error || err?.message || 'Failed to fetch code list from directory', type: 'error' })
            setTimeout(() => setToastMessage(null), 5000)
        } finally {
            setIsFetchingDirectory(false)
        }
    }

    const handleResetToRepository = () => {
        setIsLiveDirectoryMode(false)
        fetchCodeItems(1)
    }

    useEffect(() => {
        if (!isLiveDirectoryMode) {
            fetchCodeItems(1)
            setSelectedCodeIds(new Set())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceFilter, typeFilter, projectFilter, dateFrom, dateTo])

    // Debounced search
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            fetchCodeItems(1)
            setSelectedCodeIds(new Set())
        }, 400)
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    // Listen for AI agent invocation and parse the active/selected code object
    useEffect(() => {
        const handler = async (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.agentId) {
                const targetId = selectedRadioCodeId || (selectedCodeIds.size === 1 ? Array.from(selectedCodeIds)[0] : null)
                if (!targetId) return

                detail.handled = true
                e.stopPropagation()
                e.stopImmediatePropagation()

                const targetItem = codeItems.find(d => d.id === targetId)
                if (!targetItem) return

                const cleanName = (targetItem.name || '').replace(/\s*\([A-Za-z0-9_]+\)$/, '').trim()
                setToastMessage({ text: `Parsing "${cleanName || targetItem.name}" into ${detail.agentId}...`, type: 'success' })
                setTimeout(() => setToastMessage(null), 3500)

                try {
                    const plainContent = await fetchSourceCodeForObject(targetItem)
                    if (!plainContent) {
                        setToastMessage({ text: `Could not retrieve source code for "${cleanName || targetItem.name}" from SAP system.`, type: 'error' })
                        setTimeout(() => setToastMessage(null), 4000)
                        return
                    }

                    if (detail.agentId === 'code-advisor') {
                        window.dispatchEvent(new CustomEvent('code-advisor-open', {
                            detail: { code: plainContent, codeType: 'ABAP', programName: cleanName }
                        }))
                    } else if (detail.agentId === 'explain-code') {
                        window.dispatchEvent(new CustomEvent('explain-code-open', {
                            detail: { code: plainContent, codeType: 'ABAP', programName: cleanName }
                        }))
                    } else if (detail.agentId === 'solution-advisor') {
                        window.dispatchEvent(new CustomEvent('solution-advisor-open', {
                            detail: { requirements: plainContent }
                        }))
                    } else if (detail.agentId === 'spec-assistant') {
                        window.dispatchEvent(new CustomEvent('spec-assistant-open', {
                            detail: { requirements: plainContent }
                        }))
                    } else if (detail.agentId === 'test-cases' || detail.agentId === 'test-case-generator') {
                        window.dispatchEvent(new CustomEvent('test-case-generator-open', {
                            detail: { code: plainContent, requirements: plainContent }
                        }))
                    } else if (detail.agentId === 'prompt-generator') {
                        window.dispatchEvent(new CustomEvent('prompt-studio-open', {
                            detail: { prompt: plainContent, language: 'ABAP', task: `Analysis for ${cleanName || targetItem.name}` }
                        }))
                    } else if (detail.agentId === 'ask-yoda') {
                        window.dispatchEvent(new CustomEvent('ask-yoda-open', {
                            detail: { 
                                query: `Please analyze this ABAP code (${cleanName || targetItem.name}):\n\n\`\`\`abap\n${plainContent.substring(0, 3000)}\n\`\`\`` 
                            }
                        }))
                    }
                } catch (err) {
                    console.error('Failed to parse code for AI agent:', err)
                }
            }
        }

        window.addEventListener('agent-select', handler, { capture: true })
        return () => window.removeEventListener('agent-select', handler, { capture: true })
    }, [selectedRadioCodeId, selectedCodeIds, codeItems, selectedDirectorySource])

    const fetchSourceCodeForObject = async (item: CodeItem): Promise<string> => {
        const cleanName = (item.name || '').replace(/\s*\([A-Za-z0-9_]+\)$/, '').trim()
        let typeCode = (item.documentTypeCode || item.type || 'CLAS').toUpperCase().trim()
        const match = (item.name || '').match(/\(([A-Za-z0-9_]+)\)$/)
        if (match && match[1]) {
            typeCode = match[1].toUpperCase()
        }

        const typeMap: Record<string, string> = {
            'ABAP CLASS': 'CLAS',
            'CDS VIEW': 'DDLS',
            'PROGRAM': 'PROG',
            'ABAP PROGRAM': 'PROG',
            'INCLUDE': 'INCL',
            'ABAP INCLUDE': 'INCL',
            'FUNCTION GROUP': 'FUGR',
            'FUNCTION MODULE': 'FUNC',
            'DATABASE TABLE': 'TABL',
            'DATA DEFINITION': 'DDLS',
        }
        if (typeMap[typeCode]) {
            typeCode = typeMap[typeCode]
        }
        // Package ingest stores types as ABAP_CLAS / ABAP_PROG
        typeCode = typeCode.replace(/^ABAP_/, '')

        const token = typeof window !== 'undefined' ? (localStorage.getItem('mygo-token') || localStorage.getItem('token') || '') : ''
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        // 1. Live fetch through the backend router, bound to the item's source:
        //    BTP -> CatalogService.sourcecodeSet (ObjectType/ObjectName, Line), SAP ADT -> /source/main
        const sourceId = resolveSourceIdForItem(item)
        try {
            const res = await axios.get('/api/sap/adt/source', {
                params: { object: cleanName, type: typeCode, ...(sourceId ? { sourceId } : {}) },
                headers
            })
            if (res.data?.success && res.data?.source_code) {
                return res.data.source_code
            }
        } catch (err) {
            console.warn(`Live source fetch failed for ${cleanName}:`, err)
        }

        // 2. Synced copy stored in the repository
        const itemId = item.documentId || item.id
        if (itemId && !isLiveItem(item)) {
            try {
                const res = await axios.get(`/api/documents/${encodeURIComponent(itemId)}/view`, {
                    params: { type: typeCode, name: cleanName, source: item.source, ...(sourceId ? { sourceId } : {}) },
                    headers
                })
                const content = htmlToPlainText(res.data?.content || '')
                if (content && !content.includes('placeholder for metadata purposes')) {
                    return content
                }
            } catch (err) {
                console.warn(`Stored source fetch failed for ${cleanName}:`, err)
            }
        }

        return ''
    }

    const isLiveItem = (item: CodeItem) => item.id?.startsWith('BTP_') || item.id?.startsWith('ADT_')

    // Pick the configured code source an item belongs to (live items carry it in their id;
    // synced items store the source type or name), falling back to the selected directory source.
    const resolveSourceIdForItem = (item: CodeItem): string => {
        const liveSource = availableSources.find(s =>
            item.id?.startsWith(`BTP_${s.id}_`) || item.id?.startsWith(`ADT_${s.id}_`))
        if (liveSource) return liveSource.id
        const itemSource = String(item.source || '').toUpperCase()
        const byName = availableSources.find(s => String(s.name || '').toUpperCase() === itemSource)
        if (byName) return byName.id
        const byType = availableSources.filter(s => String(s.type || '').toUpperCase() === itemSource)
        if (byType.length === 1) return byType[0].id
        return selectedDirectorySource
    }

    const toggleCodeSelection = (id: string) => {
        setSelectedCodeIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleSelectAllCode = () => {
        if (selectedCodeIds.size === codeItems.length) {
            setSelectedCodeIds(new Set())
        } else {
            setSelectedCodeIds(new Set(codeItems.map(d => d.id)))
        }
    }

    const handleDeleteSelected = async () => {
        setIsDeleting(true)
        setShowDeleteConfirm(false)
        try {
            await Promise.all(
                Array.from(selectedCodeIds).map((id) =>
                    axios.delete(`/api/documents/${encodeURIComponent(id)}`)
                )
            )
            setSelectedCodeIds(new Set())
            await fetchCodeItems(currentPage)
        } catch (err) {
            console.error('Delete failed:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    const goToPage = (page: number) => {
        if (page < 1 || page > pagination.total_pages) return
        fetchCodeItems(page)
    }

    const openCodeViewer = async (item: CodeItem) => {
        setIsLoadingCodeContent(true)
        const cleanName = (item.name || '').replace(/\s*\([A-Za-z0-9_]+\)$/, '').trim()
        const typeCode = (item.documentTypeCode || item.type || 'CLAS').toUpperCase()
        setViewerCode({ name: cleanName || item.name, rawCode: '', formattedHtml: '', type: item.type })
        try {
            const rawCode = await fetchSourceCodeForObject(item)
            if (rawCode) {
                // Escape the code: raw ABAP field symbols (<fs_x>) would otherwise be parsed as tags and vanish
                const formattedHtml = `<div style="font-family:monospace;background:#0f172a;color:#f8fafc;padding:20px;border-radius:8px;"><h3 style="color:#38bdf8;margin-top:0;">${escapeHtml(cleanName || item.name)} (${escapeHtml(typeCode)})</h3><pre style="margin:0;white-space:pre-wrap;"><code>${escapeHtml(rawCode)}</code></pre></div>`
                setViewerCode({
                    name: cleanName || item.name,
                    rawCode: rawCode,
                    formattedHtml: formattedHtml,
                    type: item.type
                })
            } else {
                setViewerCode({
                    name: cleanName || item.name,
                    rawCode: '',
                    formattedHtml: `<p style="color:#ef4444;padding:16px;">Source code for <b>${cleanName || item.name}</b> could not be retrieved from the SAP system. Please verify SAP ADT / BTP connection status in Settings.</p>`,
                    type: item.type
                })
            }
        } catch (err: any) {
            const errMsg = err?.response?.data?.error || err?.message || 'Failed to load source code.'
            setViewerCode({
                name: cleanName || item.name,
                rawCode: '',
                formattedHtml: `<p style="color:red">${errMsg}</p>`,
                type: item.type
            })
        } finally {
            setIsLoadingCodeContent(false)
        }
    }

    const handleCopyCode = () => {
        if (!viewerCode?.rawCode) return
        navigator.clipboard.writeText(viewerCode.rawCode)
        setCopiedSuccess(true)
        setTimeout(() => setCopiedSuccess(false), 2000)
    }

    const handleDownloadCode = () => {
        if (!viewerCode?.rawCode) return
        const blob = new Blob([viewerCode.rawCode], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${viewerCode.name}.abap`
        a.click()
        URL.revokeObjectURL(url)
    }

    const launchAgentWithCurrentCode = (agentId: string) => {
        if (!viewerCode?.rawCode) return
        setViewerCode(null)
        if (agentId === 'code-advisor') {
            window.dispatchEvent(new CustomEvent('code-advisor-open', {
                detail: { code: viewerCode.rawCode, codeType: 'ABAP', programName: viewerCode.name }
            }))
        } else if (agentId === 'explain-code') {
            window.dispatchEvent(new CustomEvent('explain-code-open', {
                detail: { code: viewerCode.rawCode, codeType: 'ABAP', programName: viewerCode.name }
            }))
        } else if (agentId === 'ask-yoda') {
            window.dispatchEvent(new CustomEvent('agent-select', {
                detail: {
                    agentId: 'ask-yoda',
                    openModal: true,
                    handled: false,
                    initialQuery: `Please analyze this ABAP code object (${viewerCode.name}):\n\n\`\`\`abap\n${viewerCode.rawCode.substring(0, 3000)}\n\`\`\``
                }
            }))
        }
    }

    usePageHeader({
        title: 'Code Hub',
        subtitle: 'Manage and explore your source code and SAP repository across all sources',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#034354" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
                <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
            </svg>
        ),
        actions: (
            <div className="flex items-center gap-2.5">
                <button
                    className="btn btn-primary flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold"
                    onClick={() => setShowSyncModal(true)}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                    Sync Code
                </button>
                <GlobalAIAgentsDropdown />
            </div>
        )
    }, [setShowSyncModal])

    return (
        <div className="doc-hub-page" style={{ paddingTop: 16 }}>
            {/* Direct Source / Directory Fetch Toolbar */}
            {availableSources.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 16
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#034354' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span>SOURCE DIRECTORY FETCH:</span>
                        </div>

                        {/* Source Select */}
                        <select
                            value={selectedDirectorySource}
                            onChange={e => handleDirectorySourceChange(e.target.value)}
                            className="doc-hub-filter-select"
                            style={{ background: '#fff', fontWeight: 600, minWidth: 220 }}
                        >
                            {availableSources.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                            ))}
                        </select>

                        {/* Package / EntitySet input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                {availableSources.find(s => s.id === selectedDirectorySource)?.type === 'BTP' ? 'Entity Set / Dir:' : 'Package / Dir:'}
                            </span>
                            <input
                                type="text"
                                list="sap-package-suggestions"
                                value={directoryTarget}
                                onChange={e => setDirectoryTarget(e.target.value.toUpperCase())}
                                placeholder={availableSources.find(s => s.id === selectedDirectorySource)?.type === 'BTP' ? 'e.g. objectsSet' : 'e.g. $TMP, Z*, ZDEV'}
                                className="doc-hub-filter-select"
                                style={{ background: '#fff', minWidth: 140, fontFamily: 'monospace', fontWeight: 600 }}
                            />
                            <datalist id="sap-package-suggestions">
                                {availablePackages.map(pkg => (
                                    <option key={pkg} value={pkg} />
                                ))}
                            </datalist>
                        </div>

                        {/* Fetch Button */}
                        <button
                            className="btn btn-primary"
                            onClick={handleFetchFromDirectory}
                            disabled={isFetchingDirectory || !selectedDirectorySource}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}
                        >
                            {isFetchingDirectory ? (
                                <>
                                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white rounded-full border-t-transparent"></div>
                                    <span>Fetching Code…</span>
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="16 18 22 12 16 6" />
                                        <polyline points="8 6 2 12 8 18" />
                                    </svg>
                                    <span>Fetch Code from Directory</span>
                                </>
                            )}
                        </button>
                    </div>

                    {isLiveDirectoryMode && (
                        <button
                            onClick={handleResetToRepository}
                            style={{
                                background: '#e2e8f0',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '5px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                        >
                            <span>↻ View Saved Repository</span>
                        </button>
                    )}
                </div>
            )}

            {/* Search + Filters */}
            <div className="doc-hub-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className="doc-hub-filter-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>FILTERS</span>
                </div>

                {/* Search box */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search code…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="doc-hub-filter-select"
                        style={{ paddingLeft: 28, minWidth: 180 }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13, lineHeight: 1 }}>✕</button>
                    )}
                </div>

                <select className="doc-hub-filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="">All Sources</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="doc-hub-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">All Types</option>
                    {typeOptions.map(t => <option key={t} value={t}>{codeTypeNames[t] || t}</option>)}
                </select>
                <select className="doc-hub-filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                    <option value="">All Packages</option>
                    {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="doc-hub-date-filter">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        title="Updated on — from"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: dateFrom ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>–</span>
                    <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        title="Updated on — to"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: dateTo ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
                    />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo('') }} title="Clear date filter"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>✕</button>
                    )}
                </div>
            </div>

            {/* Code Object Count & Bulk Actions */}
            <div className="flex items-center justify-between mb-2">
                <p className="doc-hub-count" style={{ margin: 0 }}>
                    <span className="doc-hub-count-num">{pagination.total}</span> code objects found
                    {pagination.total_pages > 1 && (
                        <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 13, marginLeft: 6 }}>
                            — page {pagination.page} of {pagination.total_pages}
                        </span>
                    )}
                </p>
                {selectedCodeIds.size > 0 && (
                    <button
                        className="btn"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isDeleting}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                        </svg>
                        {isDeleting ? 'Deleting...' : `Delete (${selectedCodeIds.size})`}
                    </button>
                )}
            </div>

            {/* Toast & Active Selection Banners */}
            {toastMessage && (
                <div className={`mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${toastMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                    <span>{toastMessage.type === 'success' ? '⚡' : '⚠️'}</span>
                    <span>{toastMessage.text}</span>
                </div>
            )}
            {selectedRadioCodeId && (
                <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-sm text-emerald-800 animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">🎯 Selected for AI Agents:</span>
                        <span className="font-mono font-bold">{codeItems.find(d => d.id === selectedRadioCodeId)?.name}</span>
                        <span className="text-xs text-emerald-600 font-semibold">({codeItems.find(d => d.id === selectedRadioCodeId)?.type})</span>
                    </div>
                    <button 
                        onClick={() => setSelectedRadioCodeId(null)}
                        className="text-xs text-emerald-700 hover:text-emerald-950 underline font-semibold"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

            {/* Code Table */}
            <div className="doc-hub-table-wrapper">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading code objects...</div>
                ) : (
                    <table className="doc-hub-table">
                        <thead>
                            <tr>
                                <th style={{ width: 36, textAlign: 'center' }} title="Select active code object to parse into AI Agents">AI</th>
                                <th style={{ width: 36, textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={codeItems.length > 0 && selectedCodeIds.size === codeItems.length}
                                        onChange={toggleSelectAllCode}
                                        style={{ cursor: 'pointer' }}
                                        title="Select all on this page"
                                    />
                                </th>
                                <th>SOURCE</th>
                                <th>TYPE</th>
                                <th>CODE OBJECT / FILE NAME</th>
                                <th>UPDATED BY</th>
                                <th>UPDATED ON</th>
                                <th>PACKAGE / PROJECT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codeItems.map((item) => (
                                <tr key={item.id} className={selectedRadioCodeId === item.id ? 'bg-emerald-50/40' : selectedCodeIds.has(item.id) ? 'bg-blue-50/30' : ''}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="radio"
                                            name="code-active-radio"
                                            checked={selectedRadioCodeId === item.id}
                                            onChange={() => setSelectedRadioCodeId(item.id)}
                                            style={{ cursor: 'pointer' }}
                                            title="Click radio to select this code object for AI Agents"
                                            className="text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCodeIds.has(item.id)}
                                            onChange={() => toggleCodeSelection(item.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </td>
                                    <td>
                                        <span
                                            className="doc-source-badge"
                                            style={{
                                                backgroundColor: sourceColors[item.source]?.bg || '#f1f5f9',
                                                color: sourceColors[item.source]?.text || '#475569',
                                            }}
                                        >
                                            {item.source}
                                        </span>
                                    </td>
                                    <td className="doc-type-cell">
                                        <span className="font-medium text-slate-700">{item.type}</span>
                                    </td>
                                    <td className="doc-name-cell">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <polyline points="16 18 22 12 16 6" />
                                            <polyline points="8 6 2 12 8 18" />
                                        </svg>
                                        <button
                                            onClick={() => openCodeViewer(item)}
                                            className="hover:underline text-left text-blue-600 font-mono font-medium truncate"
                                            title="Click to view and inspect source code"
                                        >
                                            {item.name}
                                        </button>
                                    </td>
                                    <td>{item.updatedBy}</td>
                                    <td>{item.updatedOn}</td>
                                    <td>
                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">
                                            {item.project}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {codeItems.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center p-8 text-gray-400">
                                        No code objects found. Try adjusting filters or clicking &quot;Sync Code&quot; to fetch from SAP.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 0' }}>
                    <button
                        onClick={() => goToPage(1)}
                        disabled={pagination.page <= 1}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', color: pagination.page <= 1 ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="First page"
                    >«</button>
                    <button
                        onClick={() => goToPage(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer', color: pagination.page <= 1 ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Previous page"
                    >‹</button>

                    {/* Page number buttons */}
                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === pagination.total_pages || Math.abs(p - pagination.page) <= 2)
                        .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                            acc.push(p)
                            return acc
                        }, [])
                        .map((p, idx) =>
                            p === '…' ? (
                                <span key={`ellipsis-${idx}`} style={{ padding: '6px 4px', color: '#94a3b8', fontSize: 13 }}>…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => goToPage(p as number)}
                                    style={{
                                        padding: '6px 11px', border: '1px solid', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                                        borderColor: p === pagination.page ? '#034354' : '#e2e8f0',
                                        background: p === pagination.page ? '#034354' : 'white',
                                        color: p === pagination.page ? 'white' : '#475569',
                                        fontWeight: p === pagination.page ? 600 : 400,
                                    }}
                                >{p}</button>
                            )
                        )
                    }

                    <button
                        onClick={() => goToPage(pagination.page + 1)}
                        disabled={pagination.page >= pagination.total_pages}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer', color: pagination.page >= pagination.total_pages ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Next page"
                    >›</button>
                    <button
                        onClick={() => goToPage(pagination.total_pages)}
                        disabled={pagination.page >= pagination.total_pages}
                        style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer', color: pagination.page >= pagination.total_pages ? '#cbd5e1' : '#475569', fontSize: 13 }}
                        title="Last page"
                    >»</button>
                </div>
            )}

            {/* Code Viewer Modal */}
            {viewerCode && (
                <div className="settings-modal-overlay" onClick={() => setViewerCode(null)}>
                    <div
                        className="settings-modal"
                        style={{ maxWidth: 960, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="settings-modal-header flex items-center justify-between">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-700">
                                        {viewerCode.type}
                                    </span>
                                    <h3 className="settings-modal-title font-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {viewerCode.name}
                                    </h3>
                                </div>
                                <p className="settings-modal-desc">SAP Source Code</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {viewerCode.rawCode && (
                                    <>
                                        <button
                                            onClick={handleCopyCode}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                            title="Copy full source code"
                                        >
                                            {copiedSuccess ? '✓ Copied!' : 'Copy Code'}
                                        </button>
                                        <button
                                            onClick={handleDownloadCode}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                            title="Download as file"
                                        >
                                            Download
                                        </button>
                                    </>
                                )}
                                <button className="settings-modal-close" onClick={() => setViewerCode(null)}>×</button>
                            </div>
                        </div>

                        {/* Quick AI Action Bar */}
                        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Quick Actions:</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => launchAgentWithCurrentCode('code-advisor')}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <span>🧠</span> Code Advisor
                                </button>
                                <button
                                    onClick={() => launchAgentWithCurrentCode('explain-code')}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-700 text-slate-700 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <span>💡</span> Explain Code
                                </button>
                                <button
                                    onClick={() => launchAgentWithCurrentCode('ask-yoda')}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 hover:border-purple-500 hover:text-purple-700 text-slate-700 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <span>🧙‍♂️</span> Ask Yoda
                                </button>
                            </div>
                        </div>

                        <div
                            className="settings-modal-body"
                            style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#0f172a' }}
                        >
                            {isLoadingCodeContent ? (
                                <div className="text-center p-8">
                                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                                    <p className="text-gray-400">Loading source code from SAP...</p>
                                </div>
                            ) : (
                                <pre className="font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre overflow-x-auto selection:bg-emerald-800 selection:text-white">
                                    <code>{viewerCode.rawCode || 'No source code found.'}</code>
                                </pre>
                            )}
                        </div>
                        <div className="settings-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setViewerCode(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
                    <div className="modal max-w-md">
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Code Objects</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-main">
                                Are you sure you want to delete <strong className="text-heading">{selectedCodeIds.size} code object{selectedCodeIds.size > 1 ? 's' : ''}</strong> from your repository? This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                className="btn"
                                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Code Modal */}
            <SyncCodeModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                onSyncComplete={fetchCodeItems}
            />
        </div>
    )
}
