'use client'

/**
 * RichTextResponse — renders markdown in chat bubbles and response panels.
 * Supports headings, bold, italic, inline code, code blocks, bullet/numbered
 * lists, horizontal rules, and tables. No external dependencies.
 */
export default function RichTextResponse({
    content,
    title,
    showCopy,
    showDownload,
    collapsible,
    onDownload
}: {
    content: string;
    title?: string;
    showCopy?: boolean;
    showDownload?: boolean;
    collapsible?: boolean;
    onDownload?: any;
}) {
    if (!content) return null

    const blocks = parseBlocks(content)

    return (
        <div style={{ fontSize: '0.83rem', lineHeight: 1.65, wordBreak: 'break-word' }}>
            {blocks.map((block, i) => renderBlock(block, i))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

type Block =
    | { type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; text: string }
    | { type: 'hr' }
    | { type: 'code'; lang: string; text: string }
    | { type: 'bullet'; items: string[] }
    | { type: 'ordered'; items: string[] }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'paragraph'; lines: string[] }

// ---------------------------------------------------------------------------
// Parser — converts raw markdown string into a list of blocks
// ---------------------------------------------------------------------------

function parseBlocks(raw: string): Block[] {
    const blocks: Block[] = []
    const lines = raw.split('\n')
    let i = 0

    while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        // Skip empty lines between blocks
        if (trimmed === '') { i++; continue }

        // Fenced code block
        if (trimmed.startsWith('```')) {
            const lang = trimmed.slice(3).trim()
            const codeLines: string[] = []
            i++
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i])
                i++
            }
            i++ // consume closing ```
            blocks.push({ type: 'code', lang, text: codeLines.join('\n') })
            continue
        }

        // Headings
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
        if (headingMatch) {
            const level = headingMatch[1].length
            const tag = `h${level}` as Block['type']
            blocks.push({ type: tag as any, text: headingMatch[2] })
            i++
            continue
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            blocks.push({ type: 'hr' })
            i++
            continue
        }

        // Bullet list — collect consecutive bullet lines
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
            const items: string[] = []
            while (i < lines.length) {
                const t = lines[i].trim()
                if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
                    items.push(t.replace(/^[-•*]\s+/, ''))
                    i++
                } else if (t === '') {
                    i++
                    // peek: if next non-empty line is also a bullet, keep collecting
                    let j = i
                    while (j < lines.length && lines[j].trim() === '') j++
                    if (j < lines.length && (lines[j].trim().startsWith('- ') || lines[j].trim().startsWith('• ') || lines[j].trim().startsWith('* '))) {
                        i = j
                    } else {
                        break
                    }
                } else {
                    break
                }
            }
            if (items.length) blocks.push({ type: 'bullet', items })
            continue
        }

        // Numbered list
        if (/^\d+[\.\)]\s/.test(trimmed)) {
            const items: string[] = []
            while (i < lines.length) {
                const t = lines[i].trim()
                if (/^\d+[\.\)]\s/.test(t)) {
                    items.push(t.replace(/^\d+[\.\)]\s+/, ''))
                    i++
                } else if (t === '') {
                    i++
                    let j = i
                    while (j < lines.length && lines[j].trim() === '') j++
                    if (j < lines.length && /^\d+[\.\)]\s/.test(lines[j].trim())) {
                        i = j
                    } else {
                        break
                    }
                } else {
                    break
                }
            }
            if (items.length) blocks.push({ type: 'ordered', items })
            continue
        }

        // Markdown table — lines containing |
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const tableLines: string[] = []
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim())
                i++
            }
            // Parse header + separator + rows
            if (tableLines.length >= 2) {
                const parseRow = (l: string) =>
                    l.slice(1, -1).split('|').map(c => c.trim())
                const headers = parseRow(tableLines[0])
                // tableLines[1] is the separator row (---|---), skip it
                const rows = tableLines.slice(2).map(parseRow)
                blocks.push({ type: 'table', headers, rows })
            }
            continue
        }

        // Paragraph — collect consecutive non-special lines
        const paraLines: string[] = []
        while (i < lines.length) {
            const t = lines[i].trim()
            if (t === '') { i++; break }
            if (
                /^#{1,6}\s/.test(t) ||
                t.startsWith('```') ||
                t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ') ||
                /^\d+[\.\)]\s/.test(t) ||
                /^(-{3,}|\*{3,}|_{3,})$/.test(t) ||
                (t.startsWith('|') && t.endsWith('|'))
            ) break
            paraLines.push(lines[i])
            i++
        }
        if (paraLines.length) blocks.push({ type: 'paragraph', lines: paraLines })
    }

    return blocks
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function renderBlock(block: Block, key: number): React.ReactNode {
    switch (block.type) {
        case 'h1':
            return <h2 key={key} style={{ fontSize: '1.05rem', fontWeight: 700, margin: '14px 0 4px', color: 'var(--heading, #1e293b)', borderBottom: '2px solid var(--glass-border, #e2e8f0)', paddingBottom: '4px' }}><InlineFormat text={block.text} /></h2>
        case 'h2':
            return <h3 key={key} style={{ fontSize: '0.97rem', fontWeight: 700, margin: '12px 0 3px', color: 'var(--heading, #1e293b)' }}><InlineFormat text={block.text} /></h3>
        case 'h3':
            return <h4 key={key} style={{ fontSize: '0.9rem', fontWeight: 600, margin: '10px 0 2px', color: 'var(--heading, #334155)' }}><InlineFormat text={block.text} /></h4>
        case 'h4':
        case 'h5':
        case 'h6':
            return <p key={key} style={{ fontSize: '0.85rem', fontWeight: 600, margin: '8px 0 2px', color: 'var(--heading, #475569)', textTransform: 'uppercase', letterSpacing: '0.03em' }}><InlineFormat text={block.text} /></p>

        case 'hr':
            return <hr key={key} style={{ border: 'none', borderTop: '1px solid var(--glass-border, #e2e8f0)', margin: '10px 0' }} />

        case 'code':
            return (
                <pre key={key} style={{
                    background: '#1e293b',
                    color: '#e2e8f0',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    overflow: 'auto',
                    margin: '8px 0',
                    whiteSpace: 'pre-wrap',
                }}>
                    {block.text}
                </pre>
            )

        case 'bullet':
            return (
                <ul key={key} style={{ margin: '4px 0 4px 0', paddingLeft: '18px' }}>
                    {block.items.map((item, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}><InlineFormat text={item} /></li>
                    ))}
                </ul>
            )

        case 'ordered':
            return (
                <ol key={key} style={{ margin: '4px 0 4px 0', paddingLeft: '20px' }}>
                    {block.items.map((item, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}><InlineFormat text={item} /></li>
                    ))}
                </ol>
            )

        case 'table':
            return (
                <div key={key} style={{ overflowX: 'auto', margin: '8px 0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                {block.headers.map((h, i) => (
                                    <th key={i} style={{
                                        padding: '5px 10px',
                                        background: 'var(--glass-bg, #f1f5f9)',
                                        borderBottom: '2px solid var(--glass-border, #e2e8f0)',
                                        textAlign: 'left',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                    }}>
                                        <InlineFormat text={h} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid var(--glass-border, #e2e8f0)' }}>
                                    {row.map((cell, ci) => (
                                        <td key={ci} style={{ padding: '4px 10px', verticalAlign: 'top' }}>
                                            <InlineFormat text={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )

        case 'paragraph':
            return (
                <p key={key} style={{ margin: '5px 0' }}>
                    {block.lines.map((line, i) => (
                        <span key={i}>
                            {i > 0 && <br />}
                            <InlineFormat text={line} />
                        </span>
                    ))}
                </p>
            )
    }
}

// ---------------------------------------------------------------------------
// Inline formatter — bold, italic, inline code
// ---------------------------------------------------------------------------

function InlineFormat({ text }: { text: string }) {
    const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g)

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('***') && part.endsWith('***')) {
                    return <strong key={i}><em>{part.slice(3, -3)}</em></strong>
                }
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                    return <em key={i}>{part.slice(1, -1)}</em>
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return (
                        <code key={i} style={{
                            background: 'rgba(99,102,241,0.08)',
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
