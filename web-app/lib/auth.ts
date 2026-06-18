export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null

    const stored = localStorage.getItem('mygo-token')
    if (stored) return stored

    const match = document.cookie.match(/(?:^|;\s*)mygo-auth=([^;]*)/)
    const cookieToken = match?.[1]
    if (cookieToken) {
        localStorage.setItem('mygo-token', cookieToken)
        return cookieToken
    }

    return null
}

export function clearAuth(): void {
    localStorage.removeItem('mygo-token')
    localStorage.removeItem('mygo-user')
    document.cookie = 'mygo-auth=; path=/; max-age=0; SameSite=Lax'
}

export function authHeaders(): Record<string, string> {
    const token = getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
}
