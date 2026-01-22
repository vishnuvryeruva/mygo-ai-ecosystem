'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface SettingsModalProps {
    onClose: () => void
}

interface PromptConfig {
    name: string
    system: string
    user_template?: string
    description: string
}

interface AllPrompts {
    [key: string]: PromptConfig
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [prompts, setPrompts] = useState<AllPrompts>({})
    const [loading, setLoading] = useState(true)
    const [selectedScenario, setSelectedScenario] = useState<string>('')
    const [editingPrompt, setEditingPrompt] = useState('')
    const [editingTemplate, setEditingTemplate] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchPrompts()
    }, [])

    const fetchPrompts = async () => {
        try {
            const response = await axios.get('/api/prompts')
            setPrompts(response.data.prompts)

            // Select first scenario by default
            const scenarios = Object.keys(response.data.prompts)
            if (scenarios.length > 0) {
                setSelectedScenario(scenarios[0])
                setEditingPrompt(response.data.prompts[scenarios[0]].system)
                setEditingTemplate(response.data.prompts[scenarios[0]].user_template || '')
            }
        } catch (error) {
            console.error('Error fetching prompts:', error)
            alert('Error loading prompts')
        } finally {
            setLoading(false)
        }
    }

    const handleScenarioChange = (scenario: string) => {
        setSelectedScenario(scenario)
        setEditingPrompt(prompts[scenario].system)
        setEditingTemplate(prompts[scenario].user_template || '')
    }

    const handleSave = async () => {
        if (!selectedScenario) return

        setSaving(true)
        try {
            // Save system prompt
            await axios.put(`/api/prompts/${selectedScenario}`, {
                prompt_type: 'system',
                prompt: editingPrompt
            })

            // Save user template if it exists
            if (editingTemplate) {
                await axios.put(`/api/prompts/${selectedScenario}`, {
                    prompt_type: 'user_template',
                    prompt: editingTemplate
                })
            }

            alert('Prompts saved successfully!')

            // Refresh prompts
            await fetchPrompts()
        } catch (error) {
            console.error('Error saving prompts:', error)
            alert('Error saving prompts')
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        if (!selectedScenario) return

        if (confirm('Reset this prompt to default? This will reload the current saved version.')) {
            setEditingPrompt(prompts[selectedScenario].system)
            setEditingTemplate(prompts[selectedScenario].user_template || '')
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal max-w-6xl" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title flex items-center gap-2">
                        <span className="text-2xl">⚙️</span>
                        Settings - AI Prompts
                    </h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                {loading ? (
                    <div className="modal-body text-center py-12">
                        <div className="spinner w-8 h-8 mx-auto mb-4" />
                        <p className="text-gray-400">Loading prompts...</p>
                    </div>
                ) : (
                    <div className="flex" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                        {/* Sidebar - Scenario List */}
                        <div className="w-1/3 border-r border-white/10 p-4 bg-black/20 overflow-y-auto">
                            <h3 className="font-semibold text-white mb-4">AI Scenarios</h3>
                            <ul className="space-y-2">
                                {Object.entries(prompts).map(([key, config]) => (
                                    <li key={key}>
                                        <button
                                            onClick={() => handleScenarioChange(key)}
                                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedScenario === key
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                                                : 'glass-subtle text-gray-300 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="font-medium">{config.name}</div>
                                            <div className="text-xs mt-1 opacity-75">{config.description}</div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Main Content - Prompt Editor */}
                        <div className="w-2/3 p-6 overflow-y-auto">
                            {selectedScenario && (
                                <>
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                            {prompts[selectedScenario].name}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            {prompts[selectedScenario].description}
                                        </p>
                                    </div>

                                    {/* System Prompt */}
                                    <div className="input-group">
                                        <label className="input-label">System Prompt</label>
                                        <p className="text-xs text-gray-500 mb-2">
                                            This defines the AI's role and behavior for this scenario.
                                        </p>
                                        <textarea
                                            value={editingPrompt}
                                            onChange={(e) => setEditingPrompt(e.target.value)}
                                            className="input font-mono text-sm"
                                            rows={8}
                                            placeholder="Enter system prompt..."
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>

                                    {/* User Template (if exists) */}
                                    {prompts[selectedScenario].user_template && (
                                        <div className="input-group">
                                            <label className="input-label">User Prompt Template</label>
                                            <p className="text-xs text-gray-500 mb-2">
                                                Template for user prompts. Use {'{'}variable{'}'} for dynamic values.
                                            </p>
                                            <textarea
                                                value={editingTemplate}
                                                onChange={(e) => setEditingTemplate(e.target.value)}
                                                className="input font-mono text-sm"
                                                rows={10}
                                                placeholder="Enter user prompt template..."
                                                style={{ resize: 'vertical' }}
                                            />
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 mb-6">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="btn btn-primary"
                                        >
                                            {saving ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="spinner w-4 h-4" />
                                                    Saving...
                                                </span>
                                            ) : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="btn btn-secondary"
                                        >
                                            Reset to Saved
                                        </button>
                                    </div>

                                    {/* Info Box */}
                                    <div className="glass-subtle p-4 border-l-4 border-yellow-500">
                                        <h4 className="font-medium text-yellow-300 mb-2">⚠️ Note</h4>
                                        <p className="text-sm text-gray-400">
                                            Changes to prompts are stored in memory and will be reset when the backend restarts.
                                            For persistent changes, modify the prompts in the backend configuration file.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
