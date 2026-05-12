'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type AuthMode = 'signin' | 'signup'

function getFriendlyError(message: string) {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Fel e-post eller lösenord.'
  }

  return message
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const urlError = searchParams.get('error')
  const authMessage = useMemo(() => {
    if (urlError === 'no-membership') {
      return 'Du är inloggad, men saknar aktiv företagstillhörighet. Slutför onboarding först.'
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

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      setLoading(false)

      if (error) {
        setError(getFriendlyError(error.message))
        return
      }

      router.push('/')
      router.refresh()
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    setLoading(false)

    if (error) {
      setError(getFriendlyError(error.message))
      return
    }

    if (!data.session) {
      setNotice('Kontot skapades. Bekräfta din e-post om Supabase kräver det och logga sedan in.')
      setMode('signin')
      return
    }

    router.push('/setup')
    router.refresh()
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="coordiqo-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="coordiqo-badge coordiqo-badge--success">Coordiqo • Batch 1B</div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Byggt för planering, drift och fältteam från dag ett.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Coordiqo är grunden för en multi-tenant operationsplattform där företag får sitt eget
                  läge, sin egen data och en enklare vardag för både admin och personal.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Det här ingår i grunden</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Multi-tenant med företagsisolering</li>
                  <li>• Roller, team och onboarding</li>
                  <li>• Mobilvänlig grund från start</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Nästa steg efter login</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Skapa första företag</li>
                  <li>• Välj bransch och driftmodell</li>
                  <li>• Fortsätt till dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Välkommen till Coordiqo</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {mode === 'signin' ? 'Logga in' : 'Skapa konto'}
              </h2>
            </div>
            <div className="rounded-full bg-slate-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                  setNotice(null)
                }}
                className={`rounded-full px-3 py-2 font-medium transition ${
                  mode === 'signin' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Logga in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setNotice(null)
                }}
                className={`rounded-full px-3 py-2 font-medium transition ${
                  mode === 'signup' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Skapa konto
              </button>
            </div>
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
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Fullständigt namn</label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Till exempel Hekmat Hourani"
                  required={mode === 'signup'}
                />
              </div>
            )}

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
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? mode === 'signin'
                  ? 'Loggar in...'
                  : 'Skapar konto...'
                : mode === 'signin'
                  ? 'Logga in'
                  : 'Skapa konto'}
            </button>
          </form>

          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Bra att veta</p>
            <p>
              För att komma hela vägen behöver du efter registrering skapa ditt första företag och välja
              bransch i onboarding-steget.
            </p>
            <p>
              Om e-postbekräftelse är aktiverad i Supabase behöver du först bekräfta mejlet och sedan logga
              in igen.
            </p>
            <Link href="/" className="inline-flex font-medium text-indigo-600 hover:text-indigo-500">
              Till startsidan
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
