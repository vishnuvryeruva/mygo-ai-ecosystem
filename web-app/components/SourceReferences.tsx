'use client'

/**
 * SourceReferences — renders a collapsible "Sources" section
 * showing which documents were used to generate an AI answer.
 * Documents with a stable document_id open the same preview as Document Hub (/api/.../view).
 */

import { useState } from 'react'
import axios from 'axios'

export interface Reference {
    document_name: string
    source: string
    project: string
    doc_type: string
    web_url?: string
    /** Stable id for /api/documents/{id}/view (Postgres document_id / CALM id / upload key) */
    document_id?: string
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

function refDocumentId(ref: Reference): string | undefined {
    const id = ref.document_id?.trim()
    if (id) return id
    const anyRef = ref as Reference & { documentId?: string }
    return anyRef.documentId?.trim() || undefined
}

export default function SourceReferences({ references }: { references: Reference[] }) {
    const [expanded, setExpanded] = useState(false)
    const [viewerDoc, setViewerDoc] = useState<{ name: string; content: string } | null>(null)
    const [isLoadingContent, setIsLoadingContent] = useState(false)

    const openDocumentPreview = async (documentId: string, name: string) => {
        setIsLoadingContent(true)
        setViewerDoc({ name, content: '' })
        try {
            const res = await axios.get(`/api/documents/${encodeURIComponent(documentId)}/view`)
            setViewerDoc({ name, content: res.data.content || '' })
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } }
            const errMsg = ax?.response?.data?.error || 'Failed to load content.'
            setViewerDoc({ name, content: `<p style="color:#b91c1c">${errMsg}</p>` })
        } finally {
            setIsLoadingContent(false)
        }
    }

    if (!references || references.length === 0) return null

    return (
        <div className="source-references">
            <button
                type="button"
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
                    {references.map((ref, idx) => {
                        const docId = refDocumentId(ref)
                        const key = docId || `${ref.document_name}-${idx}`
                        return (
                            <div key={key} className="ref-card">
                                <div className="ref-card-header">
                                    <DocTypeIcon type={ref.doc_type} />
                                    <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                        {docId ? (
                                            <button
                                                type="button"
                                                className="ref-card-name ref-card-link"
                                                title={`Preview: ${ref.document_name}`}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    font: 'inherit',
                                                    textAlign: 'left',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                onClick={() => openDocumentPreview(docId, ref.document_name)}
                                            >
                                                {ref.document_name}
                                            </button>
                                        ) : ref.web_url ? (
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
                                        {docId && ref.web_url && (
                                            <a
                                                href={ref.web_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Open in source"
                                                style={{ flexShrink: 0, color: 'var(--mygo-midnight-green)', opacity: 0.85 }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                                                </svg>
                                            </a>
                                        )}
                                    </span>
                                </div>
                                <div className="ref-card-meta">
                                    <span className="ref-badge">{ref.source}</span>
                                    {ref.project && ref.project !== 'N/A' && (
                                        <span className="ref-project">{ref.project}</span>
                                    )}
                                    <span className="ref-type">{ref.doc_type}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {viewerDoc && (
                <div
                    className="settings-modal-overlay"
                    style={{ zIndex: 220 }}
                    onClick={() => setViewerDoc(null)}
                    role="presentation"
                >
                    <div
                        className="settings-modal"
                        style={{ maxWidth: 860, width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="source-preview-title"
                    >
                        <div className="settings-modal-header">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3
                                    id="source-preview-title"
                                    className="settings-modal-title"
                                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {viewerDoc.name}
                                </h3>
                                <p className="settings-modal-desc">Document content</p>
                            </div>
                            <button type="button" className="settings-modal-close" onClick={() => setViewerDoc(null)} aria-label="Close">
                                ×
                            </button>
                        </div>
                        <div
                            className="settings-modal-body"
                            style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}
                        >
                            {isLoadingContent ? (
                                <div className="text-center p-8">
                                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4" />
                                    <p className="text-gray-500">Loading document content...</p>
                                </div>
                            ) : (
                                <div
                                    className="prose max-w-none"
                                    style={{ fontSize: 14, lineHeight: 1.7 }}
                                    dangerouslySetInnerHTML={{ __html: viewerDoc.content }}
                                />
                            )}
                        </div>
                        <div className="settings-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setViewerDoc(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
