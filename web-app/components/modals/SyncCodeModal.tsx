'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import AppModal from './AppModal'

interface Source {
    id: string
    name: string
    type: string
}

interface Project {
    id: string
    name: string
    webUrl?: string
}

interface SyncCodeModalProps {
    isOpen: boolean
    onClose: () => void
    onSyncComplete?: () => void
    preSelectedSourceId?: string | null
}

const isCodeSyncableSource = (source: Source) => {
    const sourceType = String(source?.type || '').trim().toUpperCase()
    return sourceType === 'SAP_ADT' || sourceType === 'SAP_ADT_MCP' || sourceType === 'BTP'
}

// Map SAP code object types to readable labels
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
    BDEF: 'Behavior Definition',
    DEVC: 'Package',
}

const getCodeTypeIcon = (type: string) => {
    const uc = (type || '').toUpperCase()
    if (uc.includes('CLAS') || uc.includes('CLASS')) return '🏛️'
    if (uc.includes('INTF') || uc.includes('INTERFACE')) return '🔌'
    if (uc.includes('PROG') || uc.includes('PROGRAM')) return '📜'
    if (uc.includes('FUGR') || uc.includes('FUNC')) return '⚡'
    if (uc.includes('DDLS') || uc.includes('CDS')) return '👁️'
    if (uc.includes('TABL') || uc.includes('TABLE')) return '🗄️'
    if (uc.includes('VIEW')) return '📊'
    return '💻'
}

export default function SyncCodeModal({ isOpen, onClose, onSyncComplete, preSelectedSourceId }: SyncCodeModalProps) {
    const [syncStep, setSyncStep] = useState(1) // 1: Source, 2: Package/Project, 3: Fetching/Confirm, 4: Result
    const [sources, setSources] = useState<Source[]>([])
    const [selectedSource, setSelectedSource] = useState('')
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProject, setSelectedProject] = useState('')
    const [customPackage, setCustomPackage] = useState('')
    const [codeToSync, setCodeToSync] = useState<any[]>([])
    const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set())
    const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({})
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncProgressText, setSyncProgressText] = useState('')
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
    const [syncResult, setSyncResult] = useState<{ message: string; count: number; updated: number; added: number } | null>(null)

    const selectedSourceObj = sources.find(s => s.id === selectedSource)
    const isAdtSelected = Boolean(selectedSourceObj && (selectedSourceObj.type === 'SAP_ADT' || selectedSourceObj.type === 'SAP_ADT_MCP'))

    useEffect(() => {
        if (isOpen) {
            loadSources()
        } else {
            handleResetSync()
        }
    }, [isOpen])

    useEffect(() => {
        if (selectedSource) {
            loadProjects(selectedSource)
        }
    }, [selectedSource])

    const loadSources = async () => {
        try {
            const res = await axios.get('/api/sources')
            const allSources: Source[] = res.data.sources || []
            const syncable = allSources.filter(isCodeSyncableSource)
            setSources(syncable)

            // Auto-select if preSelectedSourceId matches or only 1 source
            if (preSelectedSourceId && syncable.some(s => s.id === preSelectedSourceId)) {
                setSelectedSource(preSelectedSourceId)
                setSyncStep(2)
            } else if (syncable.length === 1) {
                setSelectedSource(syncable[0].id)
            }
        } catch (err) {
            console.error('Failed to load sources for Code Hub:', err)
        }
    }

    const loadProjects = async (sourceId: string) => {
        setIsLoadingProjects(true)
        setProjectLoadError(null)
        try {
            const chosen = sources.find(s => s.id === sourceId)
            const isAdt = chosen && (chosen.type === 'SAP_ADT' || chosen.type === 'SAP_ADT_MCP')
            if (isAdt) {
                try {
                    const res = await axios.get(`/api/calm/${sourceId}/projects`)
                    const list = res.data?.projects || []
                    if (list.length > 0) {
                        setProjects(list.map((p: any) => ({
                            id: p.id || p.name,
                            name: p.name || p.id
                        })))
                        setSelectedProject(list[0].id || list[0].name)
                        return
                    }
                } catch (pkgErr) {
                    console.warn('Could not load dynamic packages for ADT:', pkgErr)
                }
                setProjects([
                    { id: '$TMP', name: '$TMP (Local Objects)' },
                    { id: 'Z*', name: 'Z* (All Custom Objects)' },
                    { id: 'ZDEV', name: 'ZDEV (Main Development Package)' },
                    { id: 'ZABAPGIT_STAND_GG', name: 'ZABAPGIT_STAND_GG (abapGit Standalone)' },
                    { id: 'ZABAP_MCP', name: 'ZABAP_MCP (SAP ADT MCP Bridge)' },
                    { id: 'Z001', name: 'Z001 (Core Objects)' },
                    { id: 'ZFIORI', name: 'ZFIORI (Fiori & OData Services)' }
                ])
                setSelectedProject('$TMP')
                return
            }

            const res = await axios.get(`/api/btp/${sourceId}/fetch-code?entity_set=ObjlistSet&top=1`)
            setProjects([
                { id: 'ObjlistSet', name: 'ObjlistSet (All Objects)' },
                { id: '$TMP', name: '$TMP Package' }
            ])
            setSelectedProject('ObjlistSet')
        } catch (err: any) {
            setProjects([
                { id: '$TMP', name: '$TMP (Default Package)' }
            ])
            setSelectedProject('$TMP')
        } finally {
            setIsLoadingProjects(false)
        }
    }

    const handleSyncNext = async () => {
        if (syncStep === 1 && selectedSource) {
            setSyncStep(2)
        } else if (syncStep === 2 && (selectedProject || customPackage || isAdtSelected)) {
            const targetPkg = (customPackage.trim() || selectedProject || '$TMP').toUpperCase()
            if (isAdtSelected && customPackage.trim()) {
                setSelectedProject(customPackage.trim().toUpperCase())
            }
            setSyncStep(3)
            setIsSyncing(true)
            setSyncProgressText(`Fetching live code objects for package "${targetPkg}" from SAP...`)
            try {
                const token = typeof window !== 'undefined' ? (localStorage.getItem('mygo-token') || localStorage.getItem('token') || '') : ''
                const headers: Record<string, string> = {}
                if (token) headers['Authorization'] = `Bearer ${token}`
                // Route SAP calls to the selected source instead of the first configured one
                headers['X-Source-Id'] = selectedSource

                let items: any[] = []
                if (isAdtSelected) {
                    if (targetPkg.includes('*')) {
                        const sRes = await axios.get(`/api/sap/adt/search`, { params: { query: targetPkg, maxResults: 100 }, headers })
                        items = (sRes.data?.objects || []).map((o: any, i: number) => ({
                            id: o.name || `ADT_${i}`,
                            name: o.name,
                            title: o.name,
                            type: o.type || 'CLAS',
                            documentTypeCode: o.type || 'CLAS',
                            description: o.description || ''
                        }))
                    } else {
                        try {
                            const pRes = await axios.get(`/api/sap/adt/packages/${encodeURIComponent(targetPkg)}`, { headers })
                            const rawObjs = pRes.data?.objects || []
                            items = rawObjs.map((o: any, i: number) => ({
                                id: o.name || `ADT_${i}`,
                                name: o.name,
                                title: o.name,
                                type: o.type || 'CLAS',
                                documentTypeCode: o.type || 'CLAS',
                                description: o.description || ''
                            }))
                        } catch {
                            const sRes = await axios.get(`/api/sap/adt/search`, { params: { query: `${targetPkg}*`, maxResults: 100 }, headers })
                            items = (sRes.data?.objects || []).map((o: any, i: number) => ({
                                id: o.name || `ADT_${i}`,
                                name: o.name,
                                title: o.name,
                                type: o.type || 'CLAS',
                                documentTypeCode: o.type || 'CLAS',
                                description: o.description || ''
                            }))
                        }
                    }
                } else {
                    // BTP source: CatalogService.ObjlistSet filtered by code types and the chosen package
                    const filterParts = ["(Objtype eq 'PROG' or Objtype eq 'FUGR' or Objtype eq 'CLAS')"]
                    if (targetPkg && targetPkg !== 'OBJLISTSET' && !targetPkg.includes('*')) {
                        filterParts.push(`Package eq '${targetPkg.replace(/'/g, "''")}'`)
                    }
                    const btpRes = await axios.get(`/api/btp/${selectedSource}/fetch-code`, {
                        // Without a Package filter the BTP service times out above ~100 rows
                        params: { entity_set: 'ObjlistSet', filter_query: filterParts.join(' and '), top: filterParts.length > 1 ? 1000 : 100 },
                        headers
                    })
                    const bData = btpRes.data?.data
                    const rawList = Array.isArray(bData) ? bData : (bData?.value || bData?.d?.results || [])
                    items = rawList.map((r: any, i: number) => ({
                        id: r.Objname || r.ObjectName || `BTP_${i}`,
                        name: r.Objname || r.ObjectName,
                        title: r.Objname || r.ObjectName,
                        type: (r.Objtype || r.ObjectType || 'PROG').toUpperCase(),
                        documentTypeCode: (r.Objtype || r.ObjectType || 'PROG').toUpperCase(),
                        description: r.Objdesc || r.Description || '',
                        package: r.Package || ''
                    }))
                }

                setCodeToSync(items)

                // Select all items by default
                const itemIds = items.map((item: any) => item.uuid || item.id)
                setSelectedCodeIds(new Set(itemIds))

                // Check sync status in background
                try {
                    const statusRes = await axios.post('/api/sync/check', {
                        documentIds: itemIds
                    })
                    setSyncStatus(statusRes.data?.syncStatus || {})
                } catch (checkErr) {
                    console.warn('Sync status check warning (non-fatal):', checkErr)
                }
            } catch (err: any) {
                console.error('Failed to fetch code from source:', err)
                alert(err?.response?.data?.error || 'Failed to fetch code objects from source.')
            } finally {
                setIsSyncing(false)
                setSyncProgressText('')
            }
        } else if (syncStep === 3) {
            // Perform actual sync of selected code objects
            setIsSyncing(true)
            try {
                const selectedItems = codeToSync.filter(item => {
                    const itemId = item.uuid || item.id
                    return selectedCodeIds.has(itemId)
                })

                if (selectedItems.length === 0) {
                    alert('Please select at least one code object to sync.')
                    setIsSyncing(false)
                    return
                }

                let syncedBy: string | undefined
                try {
                    const raw = localStorage.getItem('mygo-user')
                    if (raw) syncedBy = JSON.parse(raw)?.name || undefined
                } catch { /* ignore */ }

                // Both BTP and SAP ADT go through /api/sync, which fetches each selected object's
                // source from its source. (The package-ingest shortcut ignored the user's selection
                // and stored objects under a different ID scheme, creating duplicates.)
                // Batch sync in chunks of 15 items
                const CHUNK_SIZE = 15
                let allResults: any[] = []

                for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
                    const chunk = selectedItems.slice(i, i + CHUNK_SIZE)
                    const end = Math.min(i + CHUNK_SIZE, selectedItems.length)
                    setSyncProgressText(`Syncing code objects (${end} of ${selectedItems.length})...`)

                    const res = await axios.post('/api/sync', {
                        sourceId: selectedSource,
                        ...(syncedBy ? { syncedBy } : {}),
                        documents: chunk.map(item => ({
                            ...item,
                            id: item.uuid || item.id,
                            name: item.title || item.name,
                            type: item.documentTypeCode || item.documentType || item.type,
                            metadata: {
                                ...item,
                                uuid: item.uuid,
                                title: item.title || item.name,
                                displayId: item.displayId || item.id,
                                documentTypeCode: item.documentTypeCode || item.type,
                                projectId: item.package || item.projectId || selectedProject || customPackage || '$TMP',
                                source: sources.find(s => s.id === selectedSource)?.type || 'SAP_ADT',
                                project: item.package || selectedProject || customPackage || '$TMP'
                            }
                        }))
                    })

                    if (res.data?.results) {
                        allResults = allResults.concat(res.data.results)
                    }
                }

                const updated = allResults.filter((r: any) => r.wasExisting).length
                const added = allResults.filter((r: any) => !r.wasExisting && (r.status === 'success' || r.status === 'updated')).length
                const failed = allResults.filter((r: any) => r.status === 'error').length
                const noSource = allResults.filter((r: any) => r.status !== 'error' && r.hasContent === false).length
                const problems = [
                    failed ? `${failed} failed` : '',
                    noSource ? `${noSource} saved without source code (could not be fetched)` : '',
                ].filter(Boolean).join(', ')

                setSyncResult({
                    message: `Processed ${allResults.length} code objects${problems ? ` — ${problems}` : ''}`,
                    count: allResults.length,
                    updated: updated,
                    added: added
                })
                setSyncStep(4)
                if (onSyncComplete) onSyncComplete()
            } catch (err: any) {
                console.error('Code sync failed:', err)
                alert(err?.response?.data?.error || err?.response?.data?.message || 'Sync failed. Please check server logs.')
            } finally {
                setIsSyncing(false)
                setSyncProgressText('')
            }
        }
    }

    const handleResetSync = () => {
        setSyncStep(1)
        setSelectedSource('')
        setSelectedProject('')
        setProjects([])
        setIsLoadingProjects(false)
        setProjectLoadError(null)
        setSyncResult(null)
        setCodeToSync([])
        setSelectedCodeIds(new Set())
        setSyncStatus({})
        setSyncProgressText('')
    }

    const toggleCodeSelection = (id: string) => {
        const next = new Set(selectedCodeIds)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedCodeIds(next)
    }

    const toggleSelectAll = () => {
        if (selectedCodeIds.size === codeToSync.length) {
            setSelectedCodeIds(new Set())
        } else {
            const allIds = codeToSync.map(item => item.uuid || item.id)
            setSelectedCodeIds(new Set(allIds))
        }
    }

    const selectNew = () => {
        const newIds = codeToSync
            .filter(item => !syncStatus[item.uuid || item.id])
            .map(item => item.uuid || item.id)
        setSelectedCodeIds(new Set(newIds))
    }

    const isAllNew = codeToSync.length > 0 &&
        codeToSync.filter(item => !syncStatus[item.uuid || item.id]).every(item => selectedCodeIds.has(item.uuid || item.id)) &&
        codeToSync.filter(item => syncStatus[item.uuid || item.id]).every(item => !selectedCodeIds.has(item.uuid || item.id)) &&
        codeToSync.some(item => !syncStatus[item.uuid || item.id])

    if (!isOpen) return null

    return (
        <AppModal onClose={onClose}>
            <div>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Fetch Code From Source</h3>
                        <p className="text-sm text-muted mt-1">Step {syncStep} of 3: {
                            syncStep === 1 ? 'Select Code Source' :
                                syncStep === 2 ? 'Select SAP Package / Project' :
                                    syncStep === 3 ? 'Confirm Code Sync' : 'Complete'
                        }</p>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {syncStep === 1 && (
                        <div className="settings-form-group">
                            <label>Select Code Source</label>
                            <select
                                value={selectedSource}
                                onChange={e => setSelectedSource(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="">-- Choose a code source --</option>
                                {sources.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                ))}
                            </select>
                            {sources.length === 0 && (
                                <p className="text-sm text-gray-500 mt-2">No SAP ADT or BTP code sources configured. Go to Settings to add one.</p>
                            )}
                        </div>
                    )}

                    {syncStep === 2 && (
                        <div className="settings-form-group">
                            <label>{isAdtSelected ? 'Select SAP Package' : 'Select Project / Repository'}</label>
                            {isLoadingProjects ? (
                                <p className="text-sm text-gray-500">Loading {isAdtSelected ? 'packages' : 'projects'}...</p>
                            ) : projectLoadError ? (
                                <div>
                                    <p className="text-sm text-red-600 mb-2">Failed to load {isAdtSelected ? 'packages' : 'projects'}.</p>
                                    <p className="text-xs text-red-500">{projectLoadError}</p>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedProject}
                                        onChange={e => {
                                            setSelectedProject(e.target.value)
                                            setCustomPackage('')
                                        }}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="">{isAdtSelected ? '-- Choose a package preset --' : '-- Choose a project / repo --'}</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {isAdtSelected && (
                                        <div className="mt-4">
                                            <label className="text-sm text-gray-600 font-medium">Or enter custom SAP package name:</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. $TMP, ZFIORI_SALES, ZMY_PACKAGE"
                                                value={customPackage}
                                                onChange={e => {
                                                    setCustomPackage(e.target.value.toUpperCase())
                                                    if (e.target.value) setSelectedProject('')
                                                }}
                                                className="w-full p-2 border rounded-lg mt-1 font-mono text-sm"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Default is <code>$TMP</code> for local development objects.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {syncStep === 3 && (
                        <div>
                            {isSyncing ? (
                                <div className="text-center p-4">
                                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                                    <p className="text-sm text-gray-600 font-medium">{syncProgressText || 'Fetching code objects...'}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 flex justify-between items-center">
                                        <p>Found <strong>{codeToSync.length}</strong> code objects in this package.</p>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCodeIds.size === codeToSync.length && codeToSync.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="cursor-pointer"
                                                />
                                                <span>{selectedCodeIds.size === codeToSync.length && codeToSync.length > 0 ? "Deselect All" : "Select All"}</span>
                                            </label>
                                            <button
                                                onClick={selectNew}
                                                className={`text-sm px-2 py-0.5 rounded border transition-colors ${
                                                    isAllNew
                                                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                                                        : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                                                }`}
                                            >
                                                Select New
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto border rounded p-2 bg-gray-50">
                                        {[...codeToSync].map((item, idx) => {
                                            const itemId = item.uuid || item.id || `code_${idx}`
                                            const typeCode = item.documentTypeCode || item.documentType || item.type || 'CODE'
                                            const typeLabel = codeTypeNames[typeCode] || typeCode
                                            const isSelected = selectedCodeIds.has(itemId)
                                            const isSynced = syncStatus[itemId]

                                            return (
                                                <div
                                                    key={`${itemId}_${idx}`}
                                                    className="text-sm py-2 px-2 border-b last:border-0 flex items-center gap-3 hover:bg-gray-100 cursor-pointer"
                                                    onClick={() => toggleCodeSelection(itemId)}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleCodeSelection(itemId)}
                                                        className="cursor-pointer"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <span className="text-lg" title={typeLabel}>
                                                        {getCodeTypeIcon(typeCode)}
                                                    </span>
                                                    <div className="flex-1 flex justify-between items-center min-w-0">
                                                        <span className="font-mono font-medium truncate mr-2">{item.title || item.name}</span>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 font-semibold">
                                                                {typeLabel}
                                                            </span>
                                                            {isSynced && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                    Synced
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {codeToSync.length === 0 && (
                                            <p className="text-center text-gray-500 py-4">No code objects found in this package.</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {syncStep === 4 && syncResult && (
                        <div className="text-center p-4">
                            <div className="text-4xl mb-2">🎉</div>
                            <h4 className="font-medium text-lg text-emerald-800">Code Sync Complete!</h4>
                            <p className="text-sm text-gray-600 mt-2">{syncResult.message}</p>
                            <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
                                <span className="text-green-600">✓ {syncResult.added} Newly Added</span>
                                <span className="text-blue-600">↻ {syncResult.updated} Updated</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {syncStep < 4 ? (
                        <>
                            <button className="btn btn-secondary" onClick={onClose} disabled={isSyncing}>
                                Cancel
                            </button>
                            {syncStep > 1 && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSyncStep(syncStep - 1)}
                                    disabled={isSyncing}
                                >
                                    Back
                                </button>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={handleSyncNext}
                                disabled={
                                    (syncStep === 1 && !selectedSource) ||
                                    (syncStep === 2 && !selectedProject && !customPackage && !isAdtSelected) ||
                                    (syncStep === 3 && (selectedCodeIds.size === 0 || isSyncing))
                                }
                            >
                                {isSyncing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Syncing...</span>
                                    </div>
                                ) : syncStep === 3 ? (
                                    `Sync Selected Code (${selectedCodeIds.size})`
                                ) : (
                                    'Next'
                                )}
                            </button>
                        </>
                    ) : (
                        <button className="btn btn-primary" onClick={onClose}>
                            Done
                        </button>
                    )}
                </div>
            </div>
        </AppModal>
    )
}
