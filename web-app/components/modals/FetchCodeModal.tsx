'use client'

import React, { useState, useEffect } from 'react'

interface Source {
    id: string
    name: string
    type: string
}

interface FetchCodeModalProps {
    isOpen: boolean
    onClose: () => void
    sources: Source[]
    onFetch: (config: {
        sourceId: string
        entitySet: string
        filterQuery: string
        top: string
    }) => void
    isLoading: boolean
    initialConfig?: {
        sourceId: string
        entitySet: string
        filterQuery: string
        top: string
    }
}

export default function FetchCodeModal({
    isOpen,
    onClose,
    sources,
    onFetch,
    isLoading,
    initialConfig
}: FetchCodeModalProps) {
    const [sourceId, setSourceId] = useState(initialConfig?.sourceId || '')
    const [entitySet, setEntitySet] = useState(initialConfig?.entitySet || '')
    const [filterQuery, setFilterQuery] = useState(initialConfig?.filterQuery || '')
    const [top, setTop] = useState(initialConfig?.top || '100')

    useEffect(() => {
        if (initialConfig) {
            setSourceId(initialConfig.sourceId)
            setEntitySet(initialConfig.entitySet)
            setFilterQuery(initialConfig.filterQuery)
            setTop(initialConfig.top)
        }
    }, [initialConfig])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-6" onClick={onClose}>
            <div 
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200" 
                onClick={e => e.stopPropagation()}
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">Fetch From BTP</h3>
                            <p className="text-slate-500 text-sm font-medium">Configure your data source and filters</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* First Row: Source & Entity Set */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2.5 block">BTP Source</label>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-sm font-bold text-[#034354] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
                                value={sourceId}
                                onChange={(e) => setSourceId(e.target.value)}
                            >
                                <option value="">Select Instance</option>
                                {sources.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2.5 block">Entity Set</label>
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-sm font-bold text-[#034354] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-slate-300 shadow-sm"
                                placeholder="e.g. ObjlistSet"
                                value={entitySet}
                                onChange={(e) => setEntitySet(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Second Row: Filter Box */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2.5 block">OData Filter Query</label>
                        <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[100px] shadow-sm resizable-none"
                            placeholder="e.g. ObjectType eq 'CLAS' and Package eq 'ZCOMMON'"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                        <p className="mt-2 text-[11px] text-slate-400 italic">Example: ObjectType eq 'CLAS'</p>
                    </div>

                    {/* Third Row: Max Records (Top) */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2.5 block">Max Records (Top)</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-sm font-bold text-[#034354] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm max-w-[200px]"
                            value={top}
                            onChange={(e) => setTop(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3.5 px-6 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                        CANCEL
                    </button>
                    <button 
                        onClick={() => onFetch({ sourceId, entitySet, filterQuery, top })}
                        disabled={isLoading || !sourceId}
                        className="flex-[2] py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                            </svg>
                        )}
                        FETCH DATA
                    </button>
                </div>
            </div>
        </div>
    )
}
