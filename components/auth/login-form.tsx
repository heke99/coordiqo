'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

function getFriendlyError(message: string) {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Fel e-post eller lösenord.'
  }

  return message
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const urlError = searchParams.get('error')
  const authMessage = useMemo(() => {
    if (urlError === 'no-membership') {
      return 'Du är inloggad, men saknar aktiv företagstillhörighet. Fortsätt med onboarding för att komma vidare.'
    }

    if (urlError === 'inactive-company') {
      return 'Det här företaget är inte aktivt just nu.'
    }

    return urlError
  }, [urlError])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(getFriendlyError(error.message))
      return
    }

    const nextPath = searchParams.get('next')
    const safeNextPath = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : null

    router.replace(safeNextPath ?? '/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="coordiqo-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="coordiqo-badge coordiqo-badge--success">Coordiqo</div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  En modern plattform för drift, planering och fältteam.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Coordiqo är byggt för företag som behöver tydlig kontroll över personal, uppdrag, team,
                  platser och operativ planering utan att systemet känns tungt eller rörigt.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Från start</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Företagsisolering och roller</li>
                  <li>• Mobilvänlig struktur</li>
                  <li>• Tydlig onboarding</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Byggt för att växa</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Hemtjänst, fastighet, service och mer</li>
                  <li>• Teams, entities och uppdrag</li>
                  <li>• Planering och AI ovanpå en stark kärna</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Välkommen till Coordiqo</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Logga in</h2>
            </div>
            <a href="/book-demo" className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Request access</a>
          </div>

          {(error || authMessage) && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error ?? authMessage}
            </div>
          )}

          {notice && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">E-post</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@bolag.se"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Lösenord</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 8 tecken rekommenderas"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Arbetar...' : 'Logga in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
