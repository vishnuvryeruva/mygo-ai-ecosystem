'use client'

/**
 * SourceReferences — renders a collapsible "Sources" section
 * showing which documents were used to generate an AI answer.
 */

import { useState } from 'react'

export interface Reference {
    document_name: string
    source: string
    project: string
    doc_type: string
    web_url?: string
}

// Icon by doc_type
function DocTypeIcon({ type }: { type: string }) {
    const t = (type || '').toLowerCase()
    if (['pdf'].includes(t)) return <span className="ref-icon">📄</span>
    if (['word', 'docx'].includes(t)) return <span className="ref-icon">📝</span>
    if (['markdown', 'text', 'txt'].includes(t)) return <span className="ref-icon">📃</span>
    if (['python', 'javascript', 'typescript', 'java', 'abap'].includes(t)) return <span className="ref-icon">💻</span>
    if (['test case', 'test', 'testcase'].includes(t)) return <span className="ref-icon">🧪</span>
    if (['requirement', 'requirements'].includes(t)) return <span className="ref-icon">📋</span>
    return <span className="ref-icon">📎</span>
}

export default function SourceReferences({ references }: { references: Reference[] }) {
    const [expanded, setExpanded] = useState(false)

    if (!references || references.length === 0) return null

    return (
        <div className="source-references">
            <button
                className="source-references-toggle"
                onClick={() => setExpanded(!expanded)}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Sources ({references.length})</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`source-references-chevron ${expanded ? 'expanded' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {expanded && (
                <div className="source-references-list">
                    {references.map((ref, idx) => (
                        <div key={idx} className="ref-card">
                            <div className="ref-card-header">
                                <DocTypeIcon type={ref.doc_type} />
                                {ref.web_url ? (
                                    <a
                                        href={ref.web_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ref-card-name ref-card-link"
                                        title={ref.document_name}
                                    >
                                        {ref.document_name}
                                    </a>
                                ) : (
                                    <span className="ref-card-name" title={ref.document_name}>
                                        {ref.document_name}
                                    </span>
                                )}
                            </div>
                            <div className="ref-card-meta">
                                <span className="ref-badge">{ref.source}</span>
                                {ref.project && ref.project !== 'N/A' && (
                                    <span className="ref-project">{ref.project}</span>
                                )}
                                <span className="ref-type">{ref.doc_type}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
