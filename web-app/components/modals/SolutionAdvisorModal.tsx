'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'
import AppModal from './AppModal'

interface SolutionAdvisorModalProps {
    onClose: () => void
    onCreateSpec?: (solutionContext: string) => void
}

type Step = 'requirements' | 'solution' | 'search' | 'improvise' | 'complete'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface SimilarSolution {
    title: string
    summary: string
    relevance: number
}

export default function SolutionAdvisorModal({ onClose, onCreateSpec }: SolutionAdvisorModalProps) {
    const [currentStep, setCurrentStep] = useState<Step>('requirements')
    const [stepHistory, setStepHistory] = useState<Step[]>([])
    const [requirements, setRequirements] = useState('')
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Welcome to Solution Advisor! I'll help you explore and refine your solution before creating a functional specification.\n\nPlease describe your requirements or the problem you're trying to solve:"
        }
    ])
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [generatedSolution, setGeneratedSolution] = useState('')
    const [similarSolutions, setSimilarSolutions] = useState<SimilarSolution[]>([])
    const [finalSolution, setFinalSolution] = useState('')

    const stepLabels: Record<Step, string> = {
        requirements: 'Gather Requirements',
        solution: 'Generate Solution',
        search: 'Find Similar Solutions',
        improvise: 'Review & Improvise',
        complete: 'Ready for Spec'
    }

    const getAuthConfig = () => {
        const token = localStorage.getItem('mygo-token')
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    }

    const goToStep = (step: Step) => {
        setStepHistory(prev => [...prev, currentStep])
        setCurrentStep(step)
    }

    const handleBack = () => {
        setStepHistory(prev => {
            const history = [...prev]
            const previous = history.pop()
            if (previous) setCurrentStep(previous)
            return history
        })
    }

    const handleSendMessage = async () => {
        if (!inputValue.trim() || loading) return

        const userMessage = inputValue.trim()
        setInputValue('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setLoading(true)

        try {
            if (currentStep === 'requirements') {
                setRequirements(userMessage)
                const response = await axios.post('/api/solution-advisor/requirements', {
                    requirements: userMessage
                }, getAuthConfig())

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.data.clarifications || "Thank you for the requirements. Let me generate a solution proposal for you."
                }])

                if (!response.data.needs_clarification) {
                    await generateSolution(userMessage)
                }
            } else if (currentStep === 'solution') {
                const response = await axios.post('/api/solution-advisor/refine', {
                    requirements,
                    current_solution: generatedSolution,
                    feedback: userMessage
                }, getAuthConfig())
                setGeneratedSolution(response.data.solution)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "I've updated the solution based on your feedback. Would you like to search for similar existing solutions in your knowledge base, or continue refining?"
                }])
            } else if (currentStep === 'improvise') {
                const response = await axios.post('/api/solution-advisor/improvise', {
                    requirements,
                    current_solution: generatedSolution,
                    similar_solutions: similarSolutions.map(s => s.summary),
                    user_input: userMessage
                }, getAuthConfig())
                setFinalSolution(response.data.final_solution)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.data.message || "I've incorporated the insights. Your solution is ready! You can now create a functional specification."
                }])
                goToStep('complete')
            }
        } catch (error) {
            console.error('Error in solution advisor:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I encountered an error. Please try again."
            }])
        } finally {
            setLoading(false)
        }
    }

    const generateSolution = async (reqs: string) => {
        setLoading(true)
        try {
            const response = await axios.post('/api/solution-advisor/generate', {
                requirements: reqs
            }, getAuthConfig())
            setGeneratedSolution(response.data.solution)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `I've generated a solution proposal:\n\n${response.data.solution}\n\nWould you like to:\n1. **Refine** this solution further\n2. **Search** for similar existing solutions\n3. **Proceed** to create a functional spec`
            }])
            goToStep('solution')
        } catch (error) {
            console.error('Error generating solution:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Error generating solution. Please try again."
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleSearchSimilar = async () => {
        setLoading(true)
        goToStep('search')
        try {
            const response = await axios.post('/api/solution-advisor/search-similar', {
                solution_summary: generatedSolution
            }, getAuthConfig())
            setSimilarSolutions(response.data.similar_solutions || [])

            if (response.data.similar_solutions?.length > 0) {
                const solutionsList = response.data.similar_solutions
                    .map((s: SimilarSolution, i: number) => `${i + 1}. **${s.title}** (${Math.round(s.relevance * 100)}% relevant)\n   ${s.summary}`)
                    .join('\n\n')

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `I found ${response.data.similar_solutions.length} similar solution(s) in your knowledge base:\n\n${solutionsList}\n\nWould you like to incorporate any insights from these existing solutions?`
                }])
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "No similar solutions found in the knowledge base. Your solution appears to be unique! Would you like to proceed to create a functional specification?"
                }])
            }
            goToStep('improvise')
        } catch (error) {
            console.error('Error searching similar solutions:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Error searching for similar solutions. You can proceed to create the functional spec."
            }])
            goToStep('improvise')
        } finally {
            setLoading(false)
        }
    }

    /** Advance from solution step to improvise (step 4) without running the search API. */
    const handleNextFromSolution = () => {
        goToStep('improvise')
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Feel free to refine the solution further, or click Next to mark it ready for spec."
        }])
    }

    /** Advance to the final stepper step so the user can review the solution before opening Spec Assistant. */
    const handleProceedToSpec = () => {
        const solutionContext = finalSolution || generatedSolution
        setFinalSolution(solutionContext)
        goToStep('complete')
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Your solution is ready for review. Check the summary above, then click 'Proceed to Spec' to open the Spec Assistant—you can refine the spec or upload to Cloud ALM there."
        }])
    }

    const handleCreateFunctionalSpec = async () => {
        if (!onCreateSpec) {
            onClose()
            return
        }
        const solutionContext = finalSolution || generatedSolution
        setLoading(true)
        try {
            const response = await axios.post('/api/generate-spec', {
                type: 'functional',
                requirements: solutionContext,
                format: 'preview'
            }, getAuthConfig())
            sessionStorage.setItem('solutionAdvisorContext', solutionContext)
            sessionStorage.setItem('specAssistantPrefilledSpec', response.data.spec || '')
            onCreateSpec(solutionContext)
        } catch (error) {
            console.error('Error generating spec:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Error generating specification. Please try again."
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    return (
        <AppModal onClose={onClose}>
            <div>
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title flex items-center gap-2">
                            <span className="text-2xl">💡</span>
                            Solution Advisor
                        </h2>
                        <p className="text-sm text-muted mt-1">Conversational solution discovery and refinement</p>
                    </div>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                {/* Progress Steps - Stacked: number top, label below */}
                {(() => {
                    const steps = ['requirements', 'solution', 'search', 'improvise', 'complete'] as Step[]
                    const activeIndex = steps.indexOf(currentStep)
                    return (
                        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex-shrink-0 bg-white">
                            {/* isolate + -z-10 track keeps the line strictly behind step nodes */}
                            <div className="relative isolate flex justify-between items-center min-h-10">
                                <div
                                    className="pointer-events-none absolute left-[10%] right-[10%] top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-gray-200 dark:bg-slate-600 rounded-full"
                                    aria-hidden
                                />
                                <div
                                    className="pointer-events-none absolute left-[10%] top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-gradient-to-r from-green-500 via-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(activeIndex / 4) * 80 + 10}%` }}
                                    aria-hidden
                                />
                                {steps.map((step, index) => {
                                    const isActive = currentStep === step
                                    const isComplete = index < activeIndex
                                    return (
                                        <div key={step} className="relative z-10 flex flex-1 justify-center min-w-0">
                                            {/* Opaque backing so the track never shows through (translucent fills looked like strikethrough) */}
                                            <div
                                                className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all flex-shrink-0 shadow-sm ${isActive
                                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-indigo-500/25 ring-2 ring-indigo-400/40'
                                                    : isComplete
                                                        ? 'bg-white text-green-600 ring-2 ring-green-500 dark:bg-slate-800 dark:text-green-400 dark:ring-green-500/80'
                                                        : 'bg-white text-muted ring-2 ring-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600'
                                                    }`}
                                            >
                                                {isComplete ? '✓' : index + 1}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="relative z-10 mt-2 flex justify-between bg-white">
                                {steps.map((step) => {
                                    const isActive = currentStep === step
                                    return (
                                        <div key={`${step}-label`} className="flex flex-1 justify-center min-w-0 px-0.5">
                                            <span
                                                className={`text-[10px] sm:text-[11px] leading-tight text-center line-clamp-2 max-w-[5.5rem] sm:max-w-none ${isActive ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-muted'}`}
                                            >
                                                {stepLabels[step]}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })()}

                {/* Chat Messages */}
                <div className="modal-body space-y-4" style={{ maxHeight: '400px' }}>
                    {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 ${message.role === 'user'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                                : 'glass-subtle text-heading'
                                }`}>
                                {message.role === 'assistant' ? (
                                    <div className="text-sm">
                                        <RichTextResponse content={message.content} />
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="glass-subtle rounded-2xl p-4">
                                <div className="flex items-center gap-2 text-muted">
                                    <div className="spinner w-4 h-4" />
                                    <span className="text-sm">Thinking...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Generated Solution Preview (if available) */}
                {generatedSolution && currentStep !== 'requirements' && (
                    <div className="px-6 py-3 border-t border-[var(--glass-border)] bg-indigo-500/10">
                        <details className="cursor-pointer">
                            <summary className="text-sm font-medium text-indigo-400">📋 Current Solution (click to expand)</summary>
                            <div className="mt-2 text-sm text-muted max-h-40 overflow-y-auto p-3 glass-subtle rounded-lg">
                                <RichTextResponse content={finalSolution || generatedSolution} />
                            </div>
                        </details>
                    </div>
                )}

                {/* Action Buttons */}
                {currentStep === 'solution' && (
                    <div className="px-6 py-4 border-t border-[var(--glass-border)] bg-gray-50/50 dark:bg-black/20 flex gap-3">
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            className="btn btn-secondary"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleSearchSimilar}
                            disabled={loading}
                            className="btn btn-secondary"
                        >
                            🔍 Search Similar Solutions
                        </button>
                        <button
                            onClick={handleNextFromSolution}
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            Next →
                        </button>
                    </div>
                )}

                {currentStep === 'improvise' && (
                    <div className="px-6 py-4 border-t border-[var(--glass-border)] bg-gray-50/50 dark:bg-black/20 flex gap-3">
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            className="btn btn-secondary"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleProceedToSpec}
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            Next →
                        </button>
                    </div>
                )}

                {currentStep === 'complete' && (
                    <div className="px-6 py-4 border-t border-[var(--glass-border)] bg-green-500/10 flex gap-3">
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            className="btn btn-secondary"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleCreateFunctionalSpec}
                            disabled={loading}
                            className="btn btn-success"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="spinner w-4 h-4" />
                                    Generating spec...
                                </span>
                            ) : (
                                '➡️ Proceed to Spec'
                            )}
                        </button>
                    </div>
                )}

                {/* Input Area */}
                {currentStep !== 'complete' && (
                    <div className="modal-footer">
                        <div className="flex gap-3 w-full">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={
                                    currentStep === 'requirements'
                                        ? "Describe your requirements or answer the questions..."
                                        : "Provide feedback or ask questions..."
                                }
                                className="input flex-1"
                                disabled={loading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={loading || !inputValue.trim()}
                                className="btn btn-primary"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppModal>
    )
}
