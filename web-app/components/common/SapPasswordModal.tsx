import React, { useState, useEffect } from 'react'

interface SapPasswordModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (password: string) => void
    systemId?: string
    username?: string
    client?: string
    title?: string
    description?: string
}

export const getSessionSapCreds = () => {
    if (typeof window === 'undefined') return null
    try {
        const stored = sessionStorage.getItem('mygo_ephemeral_sap_creds')
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (e) {
        console.error('Error reading session SAP creds:', e)
    }
    return null
}

export const setSessionSapPassword = (password: string, extra?: { sapHost?: string, sapClient?: string, username?: string }) => {
    if (typeof window === 'undefined') return
    try {
        const existing = getSessionSapCreds() || {}
        sessionStorage.setItem('mygo_ephemeral_sap_creds', JSON.stringify({
            ...existing,
            ...extra,
            password
        }))
    } catch (e) {
        console.error('Error saving session SAP password:', e)
    }
}

export default function SapPasswordModal({
    isOpen,
    onClose,
    onConfirm,
    systemId = 'SAP',
    username = '',
    client = '100',
    title = 'SAP Authentication Required',
    description = 'Please enter your SAP password to execute live ADT tools.'
}: SapPasswordModalProps) {
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberForSession, setRememberForSession] = useState(true)

    useEffect(() => {
        if (isOpen) {
            const creds = getSessionSapCreds()
            if (creds?.password) {
                setPassword(creds.password)
            }
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!password.trim()) return

        if (rememberForSession) {
            setSessionSapPassword(password, { username, sapClient: client })
        }

        onConfirm(password)
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: 16,
                maxWidth: 440,
                width: '100%',
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'rgba(255, 104, 44, 0.2)',
                            border: '1px solid rgba(255, 104, 44, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18
                        }}>
                            🔐
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{description}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: 20,
                            cursor: 'pointer',
                            padding: 4
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    {/* System Info Pill */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '10px 14px',
                        marginBottom: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Target System</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                {systemId} / Client {client}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>User ID</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF682C', fontFamily: 'monospace' }}>
                                {username}
                            </span>
                        </div>
                    </div>

                    {/* Password Input */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                            SAP Password
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                required
                                placeholder="Enter SAP password"
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    fontSize: 14,
                                    border: '1.5px solid #cbd5e1',
                                    borderRadius: 8,
                                    outline: 'none',
                                    color: '#1e293b',
                                    background: '#ffffff'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    padding: '0 12px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                    cursor: 'pointer'
                                }}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
                            🔐 Zero-persistence: Password is held in browser memory only.
                        </p>
                    </div>

                    {/* Session Checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <input
                            type="checkbox"
                            id="remember_session"
                            checked={rememberForSession}
                            onChange={(e) => setRememberForSession(e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#FF682C' }}
                        />
                        <label htmlFor="remember_session" style={{ fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                            Keep unlocked for this browser session
                        </label>
                    </div>

                    {/* Footer Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#64748b',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!password.trim()}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: 8,
                                border: 'none',
                                background: !password.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #FF682C 0%, #d64a13 100%)',
                                color: !password.trim() ? '#94a3b8' : '#ffffff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: !password.trim() ? 'not-allowed' : 'pointer',
                                boxShadow: !password.trim() ? 'none' : '0 4px 12px rgba(255, 104, 44, 0.35)'
                            }}
                        >
                            Confirm & Execute
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
