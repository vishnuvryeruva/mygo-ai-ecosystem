'use client'

import React, { useState, useEffect } from 'react'

export interface SapCredentials {
    sapHost: string
    sapClient: string
    username: string
    password: string
    sapRouter?: string
}

const SESSION_STORAGE_KEY = 'mygo_ephemeral_sap_creds'

export function getStoredSapCredentials(): SapCredentials | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
        if (raw) {
            return JSON.parse(raw)
        }
    } catch (e) {
        console.error('Failed to read ephemeral SAP credentials:', e)
    }
    return null
}

export function saveStoredSapCredentials(creds: SapCredentials): void {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(creds))
    } catch (e) {
        console.error('Failed to store ephemeral SAP credentials:', e)
    }
}

export function clearStoredSapCredentials(): void {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (e) {}
}

interface SapCredentialsModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (credentials: SapCredentials) => void
    toolName?: string
    title?: string
}

export default function SapCredentialsModal({
    isOpen,
    onClose,
    onConfirm,
    toolName = 'SAP ADT Tool',
    title = 'SAP ADT Authentication'
}: SapCredentialsModalProps) {
    const [sapHost, setSapHost] = useState('')
    const [sapRouter, setSapRouter] = useState('')
    const [sapClient, setSapClient] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberSession, setRememberSession] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            const saved = getStoredSapCredentials()
            if (saved) {
                setSapHost(saved.sapHost || '')
                setSapRouter(saved.sapRouter || '')
                setSapClient(saved.sapClient || '')
                setUsername(saved.username || '')
                setPassword(saved.password || '')
            } else {
                // Fetch saved configuration from server
                fetch('/api/sources')
                    .then(res => res.json())
                    .then(data => {
                        const mcpSource = (data.sources || []).find((s: any) => s.type === 'SAP_ADT_MCP' || s.type === 'SAP_ADT')
                        if (mcpSource) {
                            fetch(`/api/sources/${mcpSource.id}`)
                                .then(r => r.json())
                                .then(detail => {
                                    const cfg = detail.config || {}
                                    if (cfg.sapHost || cfg.apiEndpoint) setSapHost(cfg.sapHost || cfg.apiEndpoint)
                                    if (cfg.saprouterString || cfg.routerString) setSapRouter(cfg.saprouterString || cfg.routerString)
                                    if (cfg.sapClient) setSapClient(cfg.sapClient)
                                    if (cfg.username) setUsername(cfg.username)
                                })
                                .catch(() => {})
                        }
                    })
                    .catch(() => {})
            }
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!sapHost.trim()) {
            setError('SAP Host URL is required.')
            return
        }
        if (!sapClient.trim()) {
            setError('SAP Client ID is required.')
            return
        }
        if (!username.trim() || !password.trim()) {
            setError('Username and Password are required.')
            return
        }

        const creds: SapCredentials = {
            sapHost: sapHost.trim(),
            sapRouter: sapRouter.trim(),
            sapClient: sapClient.trim(),
            username: username.trim(),
            password: password
        }

        if (rememberSession) {
            saveStoredSapCredentials(creds)
        } else {
            clearStoredSapCredentials()
        }

        setError('')
        onConfirm(creds)
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF682C] to-[#d64a13] flex items-center justify-center shadow-md shadow-orange-200 text-white font-black text-lg">
                            ⚡
                        </div>
                        <div>
                            <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">{title}</h3>
                            <p className="text-slate-500 text-xs font-medium">On-demand authentication for {toolName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex gap-3 items-start">
                        <span className="text-amber-600 text-base">🔒</span>
                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                            <strong className="font-bold">Zero Storage Guarantee:</strong> Your SAP credentials are only used for this session and are <u>never saved</u> to our database.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* SAP Host URL */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                            Application Server / Host URL <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF682C] transition-all"
                            placeholder="https://your-sap-server:44300 or https://mygowebdisp.mygoconsulting.com:44330"
                            value={sapHost}
                            onChange={e => setSapHost(e.target.value)}
                        />
                    </div>

                    {/* SAProuter String */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                            SAProuter String (Optional)
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF682C] transition-all"
                            placeholder="/H/router-host/H/ (leave blank if direct connection)"
                            value={sapRouter}
                            onChange={e => setSapRouter(e.target.value)}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                            Router gateway if connecting outside network (e.g. /H/50.198.15.124/H/)
                        </p>
                    </div>

                    {/* Client & Username */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                Client ID <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF682C] transition-all"
                                placeholder="e.g. 300, 100"
                                value={sapClient}
                                onChange={e => setSapClient(e.target.value)}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF682C] transition-all"
                                placeholder="e.g. ABAP_DEV"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2 items-center">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF682C] transition-all"
                                placeholder="Enter SAP developer password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-all"
                            >
                                {showPassword ? '🙈 Hide' : '👁️ Show'}
                            </button>
                        </div>
                    </div>

                    {/* Remember Session Checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="rememberSession"
                            checked={rememberSession}
                            onChange={e => setRememberSession(e.target.checked)}
                            className="w-4 h-4 accent-[#FF682C] rounded cursor-pointer"
                        />
                        <label htmlFor="rememberSession" className="text-xs text-slate-600 font-medium cursor-pointer">
                            Remember credentials for this browser session (sessionStorage)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF682C] to-[#d64a13] text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-all flex items-center gap-2"
                        >
                            <span>⚡ Proceed with ADT Action</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
