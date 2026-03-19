'use client'

import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

interface LoginPageProps {
    onLogin: (token: string, user: { id: string; name: string; email: string; role?: string }) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return
        setError('')
        setIsLoading(true)
        try {
            const { data } = await axios.post('/api/auth/login', { email, password })
            onLogin(data.token, data.user)
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'Login failed')
            } else {
                setError('Cannot connect to server. Please try again.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-page">
            {/* Background decoration */}
            <div className="login-bg-decoration">
                <div className="login-bg-circle login-bg-circle-1" />
                <div className="login-bg-circle login-bg-circle-2" />
                <div className="login-bg-circle login-bg-circle-3" />
            </div>

            <div className="login-container">
                {/* Left panel - branding */}
                <div className="login-brand-panel">
                    <div className="login-brand-content">
                        <div className="login-brand-mark-wrap">
                            <img
                                src="/my-yodaai-logo.png"
                                alt="MY YodaAI — AI Copilot for SAP"
                                width={320}
                                height={142}
                                className="login-brand-mark"
                            />
                        </div>
                        <div className="login-brand-tagline">
                            <div className="login-feature-list">
                                <div className="login-feature-item">
                                    <span className="login-feature-dot" />
                                    <span>Document Hub & Knowledge Base</span>
                                </div>
                                <div className="login-feature-item">
                                    <span className="login-feature-dot" />
                                    <span>AI-Powered Code Analysis</span>
                                </div>
                                <div className="login-feature-item">
                                    <span className="login-feature-dot" />
                                    <span>Intelligent Spec Generation</span>
                                </div>
                                <div className="login-feature-item">
                                    <span className="login-feature-dot" />
                                    <span>Automated Test Cases</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel - login form */}
                <div className="login-form-panel">
                    <div className="login-form-content">
                        <div className="login-form-header">
                            <h2>Welcome back</h2>
                            <p>Sign in to your YODA workspace</p>
                        </div>

                        {error && (
                            <div className="auth-error-banner">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="login-field">
                                <label htmlFor="email">Email</label>
                                <div className="login-input-wrapper">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="login-field">
                                <label htmlFor="password">Password</label>
                                <div className="login-input-wrapper">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" />
                                    </svg>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="login-submit-btn"
                                disabled={isLoading || !email.trim() || !password.trim()}
                            >
                                {isLoading ? (
                                    <div className="login-spinner" />
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </form>

                        <div className="auth-switch-link">
                            <p>Don&apos;t have an account? <Link href="/signup">Create one</Link></p>
                        </div>

                        <div className="login-form-footer">
                            <p>Powered by <strong>MYGO</strong> AI Ecosystem</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
