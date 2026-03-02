import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware — Auth Protection
 *
 * Checks for the `mygo-auth` cookie on every request to protected routes.
 * Unauthenticated users are redirected to /login.
 * Authenticated users hitting /login are redirected to /dashboard.
 */

const PUBLIC_PATHS = ['/login']
const STATIC_PREFIXES = ['/_next', '/api', '/favicon', '/Mygo']

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const isAuthenticated = request.cookies.get('mygo-auth')?.value === 'true'

    // Skip static assets and API routes
    if (STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next()
    }

    // Skip public files (images, etc.)
    if (pathname.includes('.')) {
        return NextResponse.next()
    }

    // Authenticated users visiting /login → redirect to dashboard
    if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Unauthenticated users on protected routes → redirect to login
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
