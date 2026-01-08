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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Settings - AI Prompts</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {loading ? (
                    <div className="p-6 text-center">
                        <p className="text-gray-500">Loading prompts...</p>
                    </div>
                ) : (
                    <div className="flex">
                        {/* Sidebar - Scenario List */}
                        <div className="w-1/3 border-r border-gray-200 p-4 bg-gray-50">
                            <h3 className="font-semibold text-gray-900 mb-4">AI Scenarios</h3>
                            <ul className="space-y-2">
                                {Object.entries(prompts).map(([key, config]) => (
                                    <li key={key}>
                                        <button
                                            onClick={() => handleScenarioChange(key)}
                                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedScenario === key
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-white text-gray-700 hover:bg-gray-100'
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
                        <div className="w-2/3 p-6">
                            {selectedScenario && (
                                <>
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            {prompts[selectedScenario].name}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {prompts[selectedScenario].description}
                                        </p>
                                    </div>

                                    {/* System Prompt */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            System Prompt
                                        </label>
                                        <p className="text-xs text-gray-500 mb-2">
                                            This defines the AI's role and behavior for this scenario.
                                        </p>
                                        <textarea
                                            value={editingPrompt}
                                            onChange={(e) => setEditingPrompt(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                                            rows={8}
                                            placeholder="Enter system prompt..."
                                        />
                                    </div>

                                    {/* User Template (if exists) */}
                                    {prompts[selectedScenario].user_template && (
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                User Prompt Template
                                            </label>
                                            <p className="text-xs text-gray-500 mb-2">
                                                Template for user prompts. Use {'{'}variable{'}'} for dynamic values.
                                            </p>
                                            <textarea
                                                value={editingTemplate}
                                                onChange={(e) => setEditingTemplate(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                                                rows={10}
                                                placeholder="Enter user prompt template..."
                                            />
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                        >
                                            Reset to Saved
                                        </button>
                                    </div>

                                    {/* Info Box */}
                                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <h4 className="font-medium text-yellow-900 mb-2">⚠️ Note</h4>
                                        <p className="text-sm text-yellow-800">
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
