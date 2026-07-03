export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { repairAllMissingDefaultsAction } from '@/lib/platform/admin-actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminHealthPage() {
  const auth = await requirePlatformAdmin()

  const [{ data: companies }, { data: settings }, { data: runtimeConfigs }, { data: sessions }, { data: memberships }] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name, status, lifecycle_status, industry_type, is_demo, created_at').is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('company_settings').select('company_id'),
    supabaseAdmin.from('industry_runtime_configs').select('company_id'),
    supabaseAdmin.from('company_onboarding_sessions').select('company_id, status'),
    supabaseAdmin.from('company_memberships').select('company_id, role, status').eq('status', 'active').is('archived_at', null),
  ])

  const hasSettings = new Set((settings ?? []).map((row) => row.company_id))
  const hasRuntime = new Set((runtimeConfigs ?? []).map((row) => row.company_id))
  const sessionByCompany = new Map((sessions ?? []).map((row) => [row.company_id, row.status]))
  const adminCountByCompany = new Map<string, number>()
  for (const membership of memberships ?? []) {
    if (membership.role === 'company_admin') {
      adminCountByCompany.set(membership.company_id, (adminCountByCompany.get(membership.company_id) ?? 0) + 1)
    }
  }

  const rows = (companies ?? []).map((company: any) => {
    const issues: string[] = []
    if (!hasSettings.has(company.id)) issues.push('Inställningar saknas')
    if (!hasRuntime.has(company.id)) issues.push('Branschkonfiguration saknas')
    if (!sessionByCompany.has(company.id)) issues.push('Onboarding-session saknas')
    if ((adminCountByCompany.get(company.id) ?? 0) === 0) issues.push('Ingen företagsadministratör')
    return { ...company, issues, onboardingStatus: sessionByCompany.get(company.id) ?? 'saknas' }
  })

  const companiesWithIssues = rows.filter((row) => row.issues.length > 0)
  const activeCompanies = rows.filter((row) => row.status === 'active' && (row.lifecycle_status ?? 'active') === 'active')

  return (
    <AppShell auth={auth} title="Plattformshälsa" subtitle="Aggregerad beredskap per bolag: grundinställningar, branschkonfiguration, onboarding och administratörer.">
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Bolag totalt</p><p className="mt-2 text-3xl font-semibold text-slate-950">{rows.length}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Aktiva bolag</p><p className="mt-2 text-3xl font-semibold text-slate-950">{activeCompanies.length}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Bolag med brister</p><p className={`mt-2 text-3xl font-semibold ${companiesWithIssues.length ? 'text-amber-600' : 'text-slate-950'}`}>{companiesWithIssues.length}</p></div>
        </section>

        {companiesWithIssues.length > 0 && (
          <section className="coordiqo-card border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-amber-950">Saknade standardinställningar</h2>
                <p className="mt-1 text-sm text-amber-800">Reparationen skapar saknade inställningar, branschkonfigurationer och onboarding-sessioner. Befintlig data påverkas inte.</p>
              </div>
              <form action={repairAllMissingDefaultsAction}>
                <button className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700">Reparera alla bolag</button>
              </form>
            </div>
          </section>
        )}

        <section className="coordiqo-card overflow-hidden">
          <div className="overflow-x-auto coordiqo-scrollbar">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left font-semibold">Bolag</th><th className="px-4 py-3 text-left font-semibold">Status</th><th className="px-4 py-3 text-left font-semibold">Bransch</th><th className="px-4 py-3 text-left font-semibold">Onboarding</th><th className="px-4 py-3 text-left font-semibold">Brister</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row: any) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3"><Link className="font-semibold text-slate-950 hover:underline" href={`/admin/companies/${row.id}`}>{row.name}</Link>{row.is_demo ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Demo</span> : null}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.lifecycle_status ?? row.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{row.industry_type ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.onboardingStatus}</td>
                    <td className="px-4 py-3">{row.issues.length ? <span className="text-amber-700">{row.issues.join(' · ')}</span> : <span className="text-emerald-700">Inga</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
