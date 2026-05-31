'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { markPasswordChangedAction, redirectAfterPasswordChangeAction } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/client'

function validatePassword(password: string) {
  if (password.length < 12) return 'Nytt lösenord måste vara minst 12 tecken.'
  if (!/[A-ZÅÄÖ]/.test(password)) return 'Nytt lösenord måste innehålla minst en stor bokstav.'
  if (!/[a-zåäö]/.test(password)) return 'Nytt lösenord måste innehålla minst en liten bokstav.'
  if (!/[0-9]/.test(password)) return 'Nytt lösenord måste innehålla minst en siffra.'
  return null
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const validation = validatePassword(newPassword)
    if (validation) {
      setLoading(false)
      setError(validation)
      return
    }
    if (newPassword !== confirmPassword) {
      setLoading(false)
      setError('Lösenorden matchar inte.')
      return
    }

    const { data: userRes } = await supabase.auth.getUser()
    const email = userRes.user?.email
    if (!email) {
      setLoading(false)
      setError('Kunde inte läsa inloggad användare.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (signInError) {
      setLoading(false)
      setError('Nuvarande tillfälliga lösenord är fel.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      currentPassword,
    } as { password: string; currentPassword: string })
    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }

    await markPasswordChangedAction()
    setLoading(false)
    router.refresh()
    await redirectAfterPasswordChangeAction()
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <section className="coordiqo-card w-full max-w-xl p-6 sm:p-8">
          <div className="coordiqo-badge coordiqo-badge--warning">First login</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Change temporary password</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">For security, you must set a new password before entering Coordiqo.</p>
          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Current temporary password</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">New password</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" />
            </label>
            <button disabled={loading} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Saving...' : 'Change password and continue'}</button>
          </form>
        </section>
      </div>
    </main>
  )
}

