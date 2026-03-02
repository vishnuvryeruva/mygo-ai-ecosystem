'use client'

/**
 * RichTextResponse — renders markdown-like text in chat bubbles.
 * Supports **bold**, bullet lists, numbered lists, and code blocks.
 * Keeps things lightweight — no external markdown parser needed.
 */
export default function RichTextResponse({ content }: { content: string }) {
    if (!content) return null

    // Split into paragraphs
    const paragraphs = content.split('\n\n')

    return (
        <div style={{ fontSize: '0.83rem', lineHeight: 1.6, wordBreak: 'break-word' }}>
            {paragraphs.map((para, pIdx) => {
                const lines = para.split('\n')

                // Check if this is a list block
                const isBulletList = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('• ') || l.trim() === '')
                const isNumberedList = lines.every(l => /^\d+\./.test(l.trim()) || l.trim() === '')

                if (isBulletList && lines.some(l => l.trim())) {
                    return (
                        <ul key={pIdx} style={{ margin: '6px 0', paddingLeft: '18px' }}>
                            {lines.filter(l => l.trim()).map((line, lIdx) => (
                                <li key={lIdx} style={{ marginBottom: '3px' }}>
                                    <InlineFormat text={line.replace(/^[\s]*[-•]\s*/, '')} />
                                </li>
                            ))}
                        </ul>
                    )
                }

                if (isNumberedList && lines.some(l => l.trim())) {
                    return (
                        <ol key={pIdx} style={{ margin: '6px 0', paddingLeft: '18px' }}>
                            {lines.filter(l => l.trim()).map((line, lIdx) => (
                                <li key={lIdx} style={{ marginBottom: '3px' }}>
                                    <InlineFormat text={line.replace(/^\d+\.\s*/, '')} />
                                </li>
                            ))}
                        </ol>
                    )
                }

                // Check for code block markers
                if (para.trim().startsWith('```')) {
                    const codeContent = para.replace(/```\w*\n?/, '').replace(/```$/, '')
                    return (
                        <pre key={pIdx} style={{
                            background: '#1e293b',
                            color: '#e2e8f0',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            overflow: 'auto',
                            margin: '6px 0',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {codeContent}
                        </pre>
                    )
                }

                // Regular paragraph
                return (
                    <p key={pIdx} style={{ margin: '5px 0' }}>
                        {lines.map((line, lIdx) => (
                            <span key={lIdx}>
                                {lIdx > 0 && <br />}
                                <InlineFormat text={line} />
                            </span>
                        ))}
                    </p>
                )
            })}
        </div>
    )
}

/** Handles **bold** and `code` inline formatting */
function InlineFormat({ text }: { text: string }) {
    // Split by **bold** and `code` markers
    const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g)

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return (
                        <code key={i} style={{
                            background: '#f1f5f9',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontSize: '0.8em',
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            color: '#c2410c',
                        }}>
                            {part.slice(1, -1)}
                        </code>
                    )
                }
                return <span key={i}>{part}</span>
            })}
        </>
    )
}
