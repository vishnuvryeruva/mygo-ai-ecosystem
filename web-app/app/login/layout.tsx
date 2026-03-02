import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign In — YODA',
    description: 'Sign in to your YODA AI workspace',
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
