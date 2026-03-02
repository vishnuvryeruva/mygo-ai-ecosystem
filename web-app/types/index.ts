// ═══════════════════════════════════════════════════════════
//  Shared TypeScript types for MYGO Web App
// ═══════════════════════════════════════════════════════════

// ── Navigation ──────────────────────────────────────────
export interface NavItem {
    id: string
    label: string
    href: string
    icon: React.ReactNode
}

// ── Chat / Agent ────────────────────────────────────────
export interface Message {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export interface AgentContext {
    id: string
    name: string
    description: string
    icon: string
    gradient: string
}

// ── Documents ───────────────────────────────────────────
export interface Document {
    id: string
    name: string
    type: string
    source: string
    project: string
    updatedBy: string
    updatedOn: string
    webUrl?: string
}

export interface DocumentInfo {
    name: string
    type: string
    size: string
    chunks: number
    uploadDate: string
    source?: string
    updatedBy?: string
    project?: string
    scope?: string
}

// ── Sources & Projects ──────────────────────────────────
export interface Source {
    id: string
    name: string
    type: string
    status?: string
    tenant?: string
    authType?: string
    lastSync?: string | null
    config?: {
        apiEndpoint?: string
        tokenUrl?: string
        clientId?: string
    }
    apiEndpoint?: string
    tokenUrl?: string
    clientId?: string
}

export interface Project {
    id: string
    name: string
    description?: string
    webUrl?: string
}

// ── User & Role ─────────────────────────────────────────
export interface User {
    id: string
    name: string
    email: string
    role: string
    status: 'Active' | 'Inactive'
}

export interface Role {
    id: string
    name: string
    permissions: string[]
}

// ── Agent Builder ───────────────────────────────────────
export interface Agent {
    id: string
    name: string
    description: string
    icon: string
    color: string
    category: 'knowledge' | 'generation' | 'analysis'
    status: 'active' | 'beta' | 'coming-soon'
}
