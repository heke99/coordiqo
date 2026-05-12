'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const INDUSTRY_OPTIONS = [
  { value: 'home_care', label: 'Hemtjänst / omsorg' },
  { value: 'healthcare', label: 'Vård / hemsjukvård' },
  { value: 'cleaning', label: 'Städ' },
  { value: 'property', label: 'Fastighet / hyresvärd' },
  { value: 'construction', label: 'Bygg' },
  { value: 'parking', label: 'Parkeringsövervakning' },
  { value: 'staffing', label: 'Bemanning' },
  { value: 'field_service', label: 'Tekniker / service' },
  { value: 'security', label: 'Bevakning' },
  { value: 'other', label: 'Annan' },
]

const OPERATIONAL_MODE_OPTIONS = [
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

export default function SetupPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [checking, setChecking] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [orgNumber, setOrgNumber] = useState('')
  const [industryType, setIndustryType] = useState('property')
  const [operationalModel, setOperationalModel] = useState('object_based')
  const [timezone, setTimezone] = useState('Europe/Stockholm')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function validateSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: membership } = await supabase
        .from('company_memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (membership) {
        router.replace('/dashboard')
        return
      }

      setChecking(false)
    }

    validateSession()
  }, [router, supabase])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.rpc('bootstrap_company_for_current_user', {
      p_company_name: companyName,
      p_org_number: orgNumber || null,
      p_industry_type: industryType,
      p_operational_model: operationalModel,
      p_timezone: timezone,
      p_default_team_name: 'Huvudteam',
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="coordiqo-shell coordiqo-card p-8 text-sm text-slate-600">Kontrollerar ditt konto...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="coordiqo-card p-6 sm:p-8">
          <div className="space-y-4">
            <div className="coordiqo-badge coordiqo-badge--warning">Första onboarding</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Skapa ditt första företag</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Det här steget kopplar ditt konto till ett företag och skapar grunddata för Batch 1. Efter det
              landar du på dashboarden och kan börja bygga vidare med team, användare och moduler.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Företagsnamn</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Till exempel Coordiqo Property AB"
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Organisationsnummer</label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  value={orgNumber}
                  onChange={(e) => setOrgNumber(e.target.value)}
                  placeholder="559999-9999"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Tidszon</label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Bransch</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  value={industryType}
                  onChange={(e) => setIndustryType(e.target.value)}
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Operativ modell</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  value={operationalModel}
                  onChange={(e) => setOperationalModel(e.target.value)}
                >
                  {OPERATIONAL_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Skapar företag...' : 'Skapa företag och fortsätt'}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="coordiqo-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Vad skapas i det här steget?</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• ett företag med egen tenant-identitet</li>
              <li>• företagets grundinställningar</li>
              <li>• en aktiv company admin-membership</li>
              <li>• ett huvudteam kopplat till dig</li>
            </ul>
          </section>

          <section className="coordiqo-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Det som fortfarande kommer senare</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• invite-flöde för fler användare</li>
              <li>• super admin bootstrap-policy</li>
              <li>• branschspecifika moduler och formulär</li>
              <li>• mer avancerad permissions matrix</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
