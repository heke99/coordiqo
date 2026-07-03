'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export type SetupOption = { value: string; label: string }

type SetupFormState = {
  companyName: string
  orgNumber: string
  industryType: string
  operationalModel: string
  locale: string
  timezone: string
  defaultTeamName: string
}

function friendlyError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('not authenticated')) return 'Du måste vara inloggad för att skapa ditt företag.'
  if (normalized.includes('already has an active company membership')) return 'Det här kontot har redan en aktiv företagstillhörighet.'
  if (normalized.includes('company name is required')) return 'Företagsnamn är obligatoriskt.'

  return 'Ansökan kunde inte skickas just nu. Försök igen eller kontakta support.'
}

export function SetupRequestForm({
  industryOptions,
  modelOptions,
  defaultIndustry,
  defaultModel,
}: {
  industryOptions: SetupOption[]
  modelOptions: SetupOption[]
  defaultIndustry: string
  defaultModel: string
}) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<SetupFormState>({
    companyName: '',
    orgNumber: '',
    industryType: defaultIndustry,
    operationalModel: defaultModel,
    locale: 'sv',
    timezone: 'Europe/Stockholm',
    defaultTeamName: 'Huvudteam',
  })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      setError('Du måste vara inloggad för att fortsätta.')
      return
    }

    const { error } = await supabase.rpc('bootstrap_company_for_current_user', {
      p_company_name: form.companyName,
      p_org_number: form.orgNumber || null,
      p_industry_type: form.industryType,
      p_operational_model: form.operationalModel,
      p_timezone: form.timezone,
      p_default_team_name: form.defaultTeamName,
      p_locale: form.locale,
    })

    if (error) {
      setLoading(false)
      setError(friendlyError(error.message))
      return
    }

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="coordiqo-card w-full p-8 text-center">
        <div className="coordiqo-badge coordiqo-badge--success">Nästa steg</div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Ansökan skickad</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Coordiqo-teamet granskar uppgifterna, skapar bolaget och aktiverar första företagsadministratör. Du får åtkomst när miljön är godkänd.
        </p>
        <a href="/login" className="mt-6 inline-flex rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">Till inloggning</a>
      </section>
    )
  }

  return (
    <section className="coordiqo-card p-5 sm:p-7">
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Granskning av Coordiqo-teamet</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Grunduppgifter</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Företagsnamn</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            type="text"
            value={form.companyName}
            onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
            placeholder="Till exempel Div3rsa AB"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Organisationsnummer</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              type="text"
              value={form.orgNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, orgNumber: e.target.value }))}
              placeholder="559123-4567"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tidszon</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              type="text"
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Standardspråk</label>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            value={form.locale}
            onChange={(e) => setForm((prev) => ({ ...prev, locale: e.target.value }))}
          >
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">Coordiqo-teamet kan ändra språket innan bolaget aktiveras.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Bransch</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              value={form.industryType}
              onChange={(e) => setForm((prev) => ({ ...prev, industryType: e.target.value }))}
            >
              {industryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Primärt arbetssätt</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
              value={form.operationalModel}
              onChange={(e) => setForm((prev) => ({ ...prev, operationalModel: e.target.value }))}
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">Detta låser inte systemet. Det styr bara vilken vy, terminologi och mallar som prioriteras först.</p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Första teamets namn</label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            type="text"
            value={form.defaultTeamName}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultTeamName: e.target.value }))}
            placeholder="Huvudteam"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Skickar ansökan...' : 'Skicka ansökan'}
        </button>
      </form>
    </section>
  )
}
