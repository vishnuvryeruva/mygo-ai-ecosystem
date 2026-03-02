import { redirect } from 'next/navigation'

/**
 * Root page — redirects to /dashboard.
 * Middleware handles the auth check: unauthenticated users will be
 * redirected to /login before this code ever runs.
 */
export default function Home() {
  redirect('/dashboard')
}
