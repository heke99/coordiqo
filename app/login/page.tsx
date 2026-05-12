'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlError = searchParams.get('error')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-black/10 p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Coordiqo</h1>
          <p className="mt-2 text-sm text-black/70">Logga in för att komma till din dashboard.</p>
        </div>

        {(error || urlError) && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error ?? (urlError === 'no-membership' ? 'Du saknar aktiv företagstillhörighet.' : urlError)}
          </div>
        )}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium">E-post</label>
            <input
              className="w-full rounded-xl border border-black/15 px-3 py-2 outline-none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Lösenord</label>
            <input
              className="w-full rounded-xl border border-black/15 px-3 py-2 outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </main>
  )
}
