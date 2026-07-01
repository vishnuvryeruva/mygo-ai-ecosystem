import axios from 'axios'

export interface DocumentForContent {
    id: string
    name: string
    type: string
    source: string
    documentId?: string
}

export function htmlToPlainText(html: string): string {
    if (!html) return ''
    const doc = typeof DOMParser !== 'undefined'
        ? new DOMParser().parseFromString(html, 'text/html')
        : null
    const text = doc?.body?.textContent || html.replace(/<[^>]+>/g, ' ')
    return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function formatTestCaseAsText(testCase: any): string {
    const lines: string[] = [testCase.title || 'Test Case', '']

    const priority = testCase.priorityCode === 10 ? 'Low' : testCase.priorityCode === 20 ? 'Medium' : testCase.priorityCode === 30 ? 'High' : 'Unknown'
    lines.push(`Priority: ${priority}`)
    lines.push(`Status: ${testCase.isPrepared ? 'Prepared' : 'Not Prepared'}`, '')

    for (const activity of testCase.toActivities || []) {
        lines.push(`Activity ${activity.sequence || ''}: ${activity.title}`)
        for (const action of activity.toActions || []) {
            lines.push(`  Step ${action.sequence || ''}: ${action.title}`)
            if (action.description?.trim()) lines.push(`    Description: ${action.description}`)
            if (action.expectedResult?.trim()) lines.push(`    Expected Result: ${action.expectedResult}`)
            if (action.isEvidenceRequired) lines.push('    Evidence Required: Yes')
        }
        lines.push('')
    }

    for (const ref of testCase.toReferences || []) {
        lines.push(`Reference: ${ref.name}${ref.url ? ` (${ref.url})` : ''}`)
    }

    return lines.join('\n').trim()
}

function formatRequirementAsText(requirement: any, fallbackName: string): string {
    const lines = [requirement.title || fallbackName, '']
    if (requirement.subStatus) lines.push(`Status: ${String(requirement.subStatus).replace(/_/g, ' ')}`)
    if (requirement.approvalState) lines.push(`Approval: ${String(requirement.approvalState).replace(/_/g, ' ')}`)
    if (requirement.assigneeName || requirement.assigneeId) {
        lines.push(`Assignee: ${requirement.assigneeName || requirement.assigneeId}`)
    }
    lines.push('')
    const body = requirement.content || ''
    lines.push(body ? htmlToPlainText(body) : 'No description content available for this requirement.')
    return lines.join('\n').trim()
}

export async function fetchDocumentPlainText(doc: DocumentForContent): Promise<string> {
    const docId = doc.documentId || doc.id
    const isTestCase = doc.type === 'Manual Test Case'
    const isRequirement = doc.type === 'Requirement'

    if (isTestCase) {
        const res = await axios.get(`/api/test-cases/${docId}`)
        return formatTestCaseAsText(res.data)
    }

    if (isRequirement) {
        const res = await axios.get(`/api/requirements/${encodeURIComponent(docId)}`)
        return formatRequirementAsText(res.data, doc.name)
    }

    const res = await axios.get(`/api/documents/${encodeURIComponent(docId)}/view`)
    return htmlToPlainText(res.data.content || '')
}

export async function fetchSelectedDocumentsPlainText(
    selectedIds: string[],
    documents: DocumentForContent[]
): Promise<string> {
    const sections: string[] = []

    for (const id of selectedIds) {
        const doc = documents.find(d => d.id === id) || { id, name: id, type: 'Document', source: '' }
        const content = await fetchDocumentPlainText(doc)
        if (selectedIds.length === 1) {
            return content
        }
        sections.push(`--- ${doc.name} ---\n${content}`)
    }

    return sections.join('\n\n').trim()
}
