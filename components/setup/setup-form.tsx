'use client'

import { useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

type SetupFormState = {
  companyName: string
  orgNumber: string
  industryType: string
  operationalModel: string
  timezone: string
  defaultTeamName: string
}

const industryOptions = [
  { value: 'home_care', label: 'Hemtjänst' },
  { value: 'healthcare', label: 'Hemsjukvård / vård' },
  { value: 'cleaning', label: 'Städ' },
  { value: 'property', label: 'Fastighet / hyresvärd' },
  { value: 'field_service', label: 'Tekniker / service' },
  { value: 'parking', label: 'Parkeringsövervakning' },
  { value: 'staffing', label: 'Bemanning' },
  { value: 'security', label: 'Bevakning / patrull' },
  { value: 'construction', label: 'Bygg' },
  { value: 'other', label: 'Annan verksamhet' },
]

const modelOptions = [
  { value: 'route_based', label: 'Ruttbaserad' },
  { value: 'area_based', label: 'Områdesbaserad' },
  { value: 'object_based', label: 'Objektbaserad' },
  { value: 'case_based', label: 'Ärendebaserad' },
  { value: 'calendar_based', label: 'Kalenderbaserad' },
  { value: 'patrol_based', label: 'Patrullbaserad' },
  { value: 'team_based', label: 'Teambaserad' },
  { value: 'project_based', label: 'Projektbaserad' },
  { value: 'on_call', label: 'Jourbaserad' },
]

function friendlyError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('not authenticated')) return 'Du måste vara inloggad för att skapa ditt företag.'
  if (normalized.includes('already has an active company membership')) {
    return 'Det här kontot är redan kopplat till ett aktivt företag. Ladda om sidan så skickas du vidare automatiskt.'
  }
  if (normalized.includes('company name is required')) return 'Företagsnamn är obligatoriskt.'
  if (normalized.includes('duplicate key value')) {
    return 'Det här företaget finns redan i systemet. Om det är ditt företag men onboarding blev halvfärdig behöver vi reparera kopplingen i nästa steg.'
  }

  return message
}

export default function SetupForm({ userEmail }: { userEmail: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<SetupFormState>({
    companyName: '',
    orgNumber: '',
    industryType: 'property',
    operationalModel: 'object_based',
    timezone: 'Europe/Stockholm',
    defaultTeamName: 'Huvudteam',
  })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.rpc('bootstrap_company_for_current_user', {
      p_company_name: form.companyName,
      p_org_number: form.orgNumber || null,
      p_industry_type: form.industryType,
      p_operational_model: form.operationalModel,
      p_timezone: form.timezone,
      p_default_team_name: form.defaultTeamName,
    })

    setLoading(false)

    if (error) {
      setError(friendlyError(error.message))
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="coordiqo-card p-6 sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div className="coordiqo-badge coordiqo-badge--success">Kom igång</div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Skapa din första Coordiqo-miljö
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Nästa steg är att skapa företaget som ska använda plattformen. När det är klart får du en egen tenant,
                grundinställningar och ditt första team direkt. Objektmodellen låses inte här, utan styrs av bransch och kan anpassas per företag.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Det som skapas nu</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Företag och företagsinställningar</li>
                  <li>• Aktiv company admin-tillhörighet</li>
                  <li>• Huvudteam för första planeringen</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Bra att ha redo</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Bolagsnamn och organisationsnummer</li>
                  <li>• Vilken bransch ni tillhör</li>
                  <li>• Hur arbetet fungerar i praktiken</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Inloggat konto</p>
              <p className="mt-1 text-base font-semibold text-slate-950">{userEmail ?? 'Okänt konto'}</p>
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5 sm:p-7">
          <div className="mb-6">
            <p className="text-sm font-medium text-slate-500">Företagsuppsättning</p>
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
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" type="text" value={form.companyName} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Till exempel Div3rsa AB" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Organisationsnummer</label>
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" type="text" value={form.orgNumber} onChange={(e) => setForm((prev) => ({ ...prev, orgNumber: e.target.value }))} placeholder="559123-4567" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Tidszon</label>
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" type="text" value={form.timezone} onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Europe/Stockholm" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Bransch</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" value={form.industryType} onChange={(e) => setForm((prev) => ({ ...prev, industryType: e.target.value }))}>
                  {industryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Operativ modell</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" value={form.operationalModel} onChange={(e) => setForm((prev) => ({ ...prev, operationalModel: e.target.value }))}>
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Första teamets namn</label>
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900" type="text" value={form.defaultTeamName} onChange={(e) => setForm((prev) => ({ ...prev, defaultTeamName: e.target.value }))} placeholder="Huvudteam" />
            </div>

            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Skapar miljön...' : 'Skapa företag och fortsätt'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
