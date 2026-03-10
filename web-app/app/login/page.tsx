'use client'

import { useRouter } from 'next/navigation'
import LoginPage from '@/components/LoginPage'

export default function LoginRoute() {
    const router = useRouter()

    const handleLogin = (token: string, user: { id: string; name: string; email: string; role?: string }) => {
        localStorage.setItem('mygo-token', token)
        localStorage.setItem('mygo-user', JSON.stringify(user))
        document.cookie = `mygo-auth=${token}; path=/; max-age=604800; SameSite=Lax`
        router.push('/dashboard')
    }

    return <LoginPage onLogin={handleLogin} />
}
