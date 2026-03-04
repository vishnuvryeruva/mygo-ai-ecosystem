'use client'

import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'

interface SignupPageProps {
    onSignup: (token: string, user: { id: string; name: string; email: string }) => void
}

export default function SignupPage({ onSignup }: SignupPageProps) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)
        try {
            const { data } = await axios.post('/api/auth/register', { name, email, password })
            onSignup(data.token, data.user)
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'Registration failed')
            } else {
                setError('Cannot connect to server. Please try again.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg-decoration">
                <div className="login-bg-circle login-bg-circle-1" />
                <div className="login-bg-circle login-bg-circle-2" />
                <div className="login-bg-circle login-bg-circle-3" />
            </div>

            <div className="login-container">
                {/* Left panel - branding */}
                <div className="login-brand-panel">
                    <div className="login-brand-content">
                        <div className="login-brand-icon">
                            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <h1 className="login-brand-title">YODA</h1>
                        <p className="login-brand-subtitle">AI-Powered SAP Intelligence</p>
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
                    <div className="login-brand-footer">
                        <img
                            src="/Mygo logotype.png"
                            alt="MYGO Logo"
                            width={64}
                            height={64}
                            className="login-brand-logo"
                        />
                    </div>
                </div>

                {/* Right panel - signup form */}
                <div className="login-form-panel">
                    <div className="login-form-content">
                        <div className="login-form-header">
                            <h2>Create your account</h2>
                            <p>Join YODA and start your AI journey</p>
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
                            {/* Full name */}
                            <div className="login-field">
                                <label htmlFor="name">Full Name</label>
                                <div className="login-input-wrapper">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <input
                                        id="name"
                                        type="text"
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            {/* Email */}
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

                            {/* Password */}
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
                                        autoComplete="new-password"
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

                            {/* Confirm password */}
                            <div className="login-field">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <div className="login-input-wrapper">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" />
                                    </svg>
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
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
                                disabled={isLoading || !name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()}
                            >
                                {isLoading ? (
                                    <div className="login-spinner" />
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>

                        <div className="auth-switch-link">
                            <p>Already have an account? <Link href="/login">Sign in</Link></p>
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
