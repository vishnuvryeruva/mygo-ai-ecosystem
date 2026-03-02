'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoginPage from '@/components/LoginPage'

export default function LoginRoute() {
    const router = useRouter()

    // If already authenticated, redirect to dashboard
    useEffect(() => {
        const auth = localStorage.getItem('mygo-auth')
        if (auth === 'true') {
            router.replace('/dashboard')
        }
    }, [router])

    const handleLogin = () => {
        // Set cookie for middleware (httpOnly not possible from client, but sufficient for demo)
        document.cookie = 'mygo-auth=true; path=/; max-age=604800; SameSite=Lax'
        router.push('/dashboard')
    }

    return <LoginPage onLogin={handleLogin} />
}
