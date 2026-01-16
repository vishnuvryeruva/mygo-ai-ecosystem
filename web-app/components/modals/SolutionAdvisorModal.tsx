'use client'

import { useState } from 'react'
import axios from 'axios'
import LoadingSpinner from '../LoadingSpinner'
import RichTextResponse from '../RichTextResponse'

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

    const handleSendMessage = async () => {
        if (!inputValue.trim() || loading) return

        const userMessage = inputValue.trim()
        setInputValue('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setLoading(true)

        try {
            if (currentStep === 'requirements') {
                // Step 1: Gather requirements
                setRequirements(userMessage)
                const response = await axios.post('/api/solution-advisor/requirements', {
                    requirements: userMessage
                })

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.data.clarifications || "Thank you for the requirements. Let me generate a solution proposal for you."
                }])

                // If AI has clarifying questions, stay in requirements step
                if (response.data.needs_clarification) {
                    // Stay in requirements step
                } else {
                    // Move to solution generation
                    await generateSolution(userMessage)
                }
            } else if (currentStep === 'solution') {
                // User is providing feedback on the solution
                const response = await axios.post('/api/solution-advisor/refine', {
                    requirements,
                    current_solution: generatedSolution,
                    feedback: userMessage
                })
                setGeneratedSolution(response.data.solution)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "I've updated the solution based on your feedback. Would you like to search for similar existing solutions in your knowledge base, or continue refining?"
                }])
            } else if (currentStep === 'improvise') {
                // User is improvising based on similar solutions
                const response = await axios.post('/api/solution-advisor/improvise', {
                    requirements,
                    current_solution: generatedSolution,
                    similar_solutions: similarSolutions.map(s => s.summary),
                    user_input: userMessage
                })
                setFinalSolution(response.data.final_solution)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.data.message || "I've incorporated the insights. Your solution is ready! You can now create a functional specification."
                }])
                setCurrentStep('complete')
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
            })
            setGeneratedSolution(response.data.solution)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `I've generated a solution proposal:\n\n${response.data.solution}\n\nWould you like to:\n1. **Refine** this solution further\n2. **Search** for similar existing solutions\n3. **Proceed** to create a functional spec`
            }])
            setCurrentStep('solution')
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
        setCurrentStep('search')
        try {
            const response = await axios.post('/api/solution-advisor/search-similar', {
                solution_summary: generatedSolution
            })
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
            setCurrentStep('improvise')
        } catch (error) {
            console.error('Error searching similar solutions:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Error searching for similar solutions. You can proceed to create the functional spec."
            }])
            setCurrentStep('improvise')
        } finally {
            setLoading(false)
        }
    }

    const handleProceedToSpec = () => {
        setCurrentStep('complete')
        const solutionContext = finalSolution || generatedSolution
        setFinalSolution(solutionContext)
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Your solution is ready! Click 'Create Functional Spec' to generate a detailed specification document based on this solution."
        }])
    }

    const handleCreateFunctionalSpec = () => {
        if (onCreateSpec) {
            onCreateSpec(finalSolution || generatedSolution)
        }
        onClose()
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">💡 Solution Advisor</h2>
                        <p className="text-sm text-gray-600 mt-1">Conversational solution discovery and refinement</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        {(['requirements', 'solution', 'search', 'improvise', 'complete'] as Step[]).map((step, index) => (
                            <div key={step} className="flex items-center">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${currentStep === step
                                        ? 'bg-orange-500 text-white'
                                        : index < ['requirements', 'solution', 'search', 'improvise', 'complete'].indexOf(currentStep)
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                    }`}>
                                    {index < ['requirements', 'solution', 'search', 'improvise', 'complete'].indexOf(currentStep) ? '✓' : index + 1}
                                </div>
                                <span className={`ml-2 text-sm ${currentStep === step ? 'font-medium text-orange-600' : 'text-gray-500'}`}>
                                    {stepLabels[step]}
                                </span>
                                {index < 4 && <div className="w-12 h-0.5 mx-3 bg-gray-200" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                <div className="whitespace-pre-wrap">{message.content}</div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-4">
                                <LoadingSpinner size="sm" text="Thinking..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Generated Solution Preview (if available) */}
                {generatedSolution && currentStep !== 'requirements' && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-blue-50">
                        <details className="cursor-pointer">
                            <summary className="text-sm font-medium text-blue-800">📋 Current Solution (click to expand)</summary>
                            <div className="mt-2 text-sm text-blue-900 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {finalSolution || generatedSolution}
                            </div>
                        </details>
                    </div>
                )}

                {/* Action Buttons */}
                {currentStep === 'solution' && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex gap-3">
                        <button
                            onClick={handleSearchSimilar}
                            disabled={loading}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                        >
                            🔍 Search Similar Solutions
                        </button>
                        <button
                            onClick={handleProceedToSpec}
                            disabled={loading}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                        >
                            ➡️ Proceed to Spec
                        </button>
                    </div>
                )}

                {currentStep === 'complete' && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-green-50 flex gap-3">
                        <button
                            onClick={handleCreateFunctionalSpec}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                            📄 Create Functional Spec
                        </button>
                    </div>
                )}

                {/* Input Area */}
                {currentStep !== 'complete' && (
                    <div className="p-4 border-t border-gray-200">
                        <div className="flex gap-3">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={
                                    currentStep === 'requirements'
                                        ? "Describe your requirements or answer the questions..."
                                        : "Provide feedback or ask questions..."
                                }
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                rows={2}
                                disabled={loading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={loading || !inputValue.trim()}
                                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
