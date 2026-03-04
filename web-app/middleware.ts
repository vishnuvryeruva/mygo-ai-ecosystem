import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']
const STATIC_PREFIXES = ['/_next', '/api', '/favicon', '/Mygo']

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const authCookie = request.cookies.get('mygo-auth')?.value
    const isAuthenticated = !!(authCookie && authCookie.length > 0)

    if (STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next()
    }

    if (pathname.includes('.')) {
        return NextResponse.next()
    }

    if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
