const BLOCK_TAGS = new Set([
    'P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'PRE', 'TABLE', 'UL', 'OL', 'BLOCKQUOTE', 'SECTION', 'ARTICLE',
])

/**
 * Convert stored/viewer HTML into plain text for AI agents.
 *
 * Uses the DOM parser instead of regex tag stripping so escaped entities are decoded
 * correctly and code such as ABAP field symbols (`<fs_data>`) or `a < b AND c > d`
 * is preserved rather than deleted as if it were a tag.
 *
 * When the HTML wraps source code in <pre>/<code> (the code viewer format), only the
 * code is returned, without the title header.
 */
export function htmlToPlainText(html: string): string {
    if (!html) return ''
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return html
    }
    const doc = new DOMParser().parseFromString(html, 'text/html')

    const pre = doc.querySelector('pre')
    if (pre) {
        return (pre.textContent || '').replace(/\s+$/, '')
    }

    doc.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
    doc.querySelectorAll('td, th').forEach(cell => cell.append('\t'))
    doc.body.querySelectorAll('*').forEach(el => {
        if (BLOCK_TAGS.has(el.tagName)) el.append('\n')
    })
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Escape text for safe insertion into an HTML string. */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
