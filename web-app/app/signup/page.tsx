'use client'

import { useRouter } from 'next/navigation'
import SignupPage from '@/components/SignupPage'

export default function SignupRoute() {
    const router = useRouter()

    const handleSignup = (token: string, user: { id: string; name: string; email: string; llm_provider?: string }) => {
        localStorage.setItem('mygo-token', token)
        localStorage.setItem('mygo-user', JSON.stringify(user))
        document.cookie = `mygo-auth=${token}; path=/; max-age=604800; SameSite=Lax`
        router.push('/dashboard')
    }

    return <SignupPage onSignup={handleSignup} />
}
