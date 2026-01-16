'use client'

import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Section {
    id: string
    title: string
    level: number
    content: string
}

interface RichTextResponseProps {
    content: string
    title?: string
    showDownload?: boolean
    downloadFileName?: string
    onDownload?: (format: 'docx' | 'pdf' | 'excel') => void
    showCopy?: boolean
    collapsible?: boolean
    className?: string
}

export default function RichTextResponse({
    content,
    title,
    showDownload = false,
    downloadFileName = 'document',
    onDownload,
    showCopy = true,
    collapsible = false,
    className = ''
}: RichTextResponseProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
    const [allExpanded, setAllExpanded] = useState(false)
    const [copied, setCopied] = useState(false)

    // Parse content into sections based on headings
    const sections = useMemo((): Section[] => {
        if (!collapsible) return []

        const lines = content.split('\n')
        const parsedSections: Section[] = []
        let currentSection: Section | null = null
        let contentBuffer: string[] = []

        lines.forEach((line, index) => {
            const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)

            if (headingMatch) {
                // Save previous section
                if (currentSection !== null) {
                    currentSection.content = contentBuffer.join('\n')
                    parsedSections.push(currentSection)
                }

                // Start new section
                currentSection = {
                    id: `section-${index}`,
                    title: headingMatch[2],
                    level: headingMatch[1].length,
                    content: ''
                }
                contentBuffer = []
            } else if (currentSection !== null) {
                contentBuffer.push(line)
            } else {
                // Content before first heading
                if (line.trim()) {
                    contentBuffer.push(line)
                }
            }
        })

        // Save last section
        if (currentSection !== null) {
            (currentSection as Section).content = contentBuffer.join('\n')
            parsedSections.push(currentSection as Section)
        }

        return parsedSections
    }, [content, collapsible])

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId)
            } else {
                newSet.add(sectionId)
            }
            return newSet
        })
    }

    const toggleAll = () => {
        if (allExpanded) {
            setExpandedSections(new Set())
        } else {
            setExpandedSections(new Set(sections.map(s => s.id)))
        }
        setAllExpanded(!allExpanded)
    }

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const isSectionExpanded = (sectionId: string) => expandedSections.has(sectionId)

    // Custom components for ReactMarkdown
    const markdownComponents = {
        h1: ({ children }: any) => (
            <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 pb-2 border-b border-gray-200">
                {children}
            </h1>
        ),
        h2: ({ children }: any) => (
            <h2 className="text-lg font-semibold text-gray-800 mt-3 mb-2">
                {children}
            </h2>
        ),
        h3: ({ children }: any) => (
            <h3 className="text-base font-semibold text-gray-700 mt-2 mb-1">
                {children}
            </h3>
        ),
        p: ({ children }: any) => (
            <p className="text-gray-700 mb-2 leading-relaxed">
                {children}
            </p>
        ),
        ul: ({ children }: any) => (
            <ul className="list-disc list-inside mb-2 ml-4 space-y-1">
                {children}
            </ul>
        ),
        ol: ({ children }: any) => (
            <ol className="list-decimal list-inside mb-2 ml-4 space-y-1">
                {children}
            </ol>
        ),
        li: ({ children }: any) => (
            <li className="text-gray-700">
                {children}
            </li>
        ),
        code: ({ inline, children }: any) => (
            inline ? (
                <code className="bg-gray-100 text-orange-600 px-1.5 py-0.5 rounded text-sm font-mono">
                    {children}
                </code>
            ) : (
                <code className="block bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto my-2">
                    {children}
                </code>
            )
        ),
        pre: ({ children }: any) => (
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto my-3">
                {children}
            </pre>
        ),
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-orange-500 pl-4 italic text-gray-600 my-2">
                {children}
            </blockquote>
        ),
        strong: ({ children }: any) => (
            <strong className="font-semibold text-gray-900">
                {children}
            </strong>
        ),
        em: ({ children }: any) => (
            <em className="italic text-gray-700">
                {children}
            </em>
        ),
        hr: () => (
            <hr className="my-4 border-gray-300" />
        ),
        table: ({ children }: any) => (
            <div className="overflow-x-auto my-3">
                <table className="min-w-full border border-gray-300 rounded-lg">
                    {children}
                </table>
            </div>
        ),
        thead: ({ children }: any) => (
            <thead className="bg-gray-100">
                {children}
            </thead>
        ),
        th: ({ children }: any) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b border-gray-300">
                {children}
            </th>
        ),
        td: ({ children }: any) => (
            <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                {children}
            </td>
        ),
    }

    return (
        <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                            {title || 'Generated Response'}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {showCopy && (
                            <button
                                onClick={copyToClipboard}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy
                                    </>
                                )}
                            </button>
                        )}

                        {showDownload && onDownload && (
                            <div className="relative group">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-orange-600 text-sm rounded-lg hover:bg-gray-100 transition-colors font-medium">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                                    <button
                                        onClick={() => onDownload('docx')}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                                        </svg>
                                        Word (.docx)
                                    </button>
                                    <button
                                        onClick={() => onDownload('pdf')}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                                        </svg>
                                        PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Collapsible Controls */}
            {collapsible && sections.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                        {sections.length} section{sections.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={toggleAll}
                        className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                    >
                        {allExpanded ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                Collapse All
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Expand All
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="p-6">
                {collapsible && sections.length > 0 ? (
                    <div className="space-y-2">
                        {sections.map((section) => (
                            <div
                                key={section.id}
                                className="border border-gray-200 rounded-lg overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                                >
                                    <span className={`font-medium text-gray-800 ${section.level === 1 ? 'text-base' : 'text-sm'}`}>
                                        {section.title}
                                    </span>
                                    <svg
                                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isSectionExpanded(section.id) ? 'rotate-180' : ''
                                            }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isSectionExpanded(section.id) ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <div className="px-4 py-3 bg-white border-t border-gray-100">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {section.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    )
}
