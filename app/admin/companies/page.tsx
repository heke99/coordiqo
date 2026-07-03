export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getActiveIndustryProfiles } from '@/lib/industry/registry'
import { updateCompanyGovernanceAction } from '@/lib/platform/actions'
import { archiveDemoCompanyAction, createDemoCompanyAction, deleteDemoCompanyAction } from '@/lib/platform/demo-company-actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

function tone(status: string | null | undefined) {
  if (status === 'active') return 'success' as const
  if (status === 'pending_approval' || status === 'paused') return 'warning' as const
  if (status === 'rejected' || status === 'archived') return 'danger' as const
  return 'neutral' as const
}

export default async function AdminCompaniesPage() {
  const auth = await requirePlatformAdmin()

  const [{ data: companies }, industryProfiles] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('id, name, slug, status, lifecycle_status, industry_type, operational_model, approval_note, is_demo, created_at, company_memberships(id, status), tasks(id), resource_assets(id), planning_runs(id)')
      .order('created_at', { ascending: false }),
    getActiveIndustryProfiles(),
  ])

  return (
    <AppShell auth={auth} title="Bolag" subtitle="Godkänn, pausa, arkivera och följ upp alla kundbolag.">
      <div className="space-y-4">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Skapa demobolag</h2>
          <p className="mt-1 text-sm text-slate-600">Skapar ett bolag med realistisk exempeldata för säljdemos. All data märks som demodata och bolagsnamnet innehåller alltid &quot;Demo&quot;.</p>
          <form action={createDemoCompanyAction} className="mt-4 grid gap-3 md:grid-cols-5">
            <label className="text-xs font-medium text-slate-600">Bransch
              <select name="industry_type" defaultValue="home_care" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {industryProfiles.map((profile) => <option key={profile.code} value={profile.code}>{profile.nameSv}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Exempeldata
              <select name="size" defaultValue="medium" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="small">Liten</option>
                <option value="medium">Medium</option>
                <option value="large">Stor</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">Antal personal
              <input name="staff_count" type="number" min={1} max={100} placeholder="auto" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600">Antal uppdrag
              <input name="task_count" type="number" min={1} max={1000} placeholder="auto" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-600">Datumintervall (dagar)
              <input name="days" type="number" min={1} max={60} placeholder="auto" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <div className="md:col-span-5">
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa demobolag</button>
            </div>
          </form>
        </section>
        {(companies ?? []).map((company: any) => {
          const lifecycle = company.lifecycle_status ?? (company.status === 'active' ? 'active' : 'paused')
          return (
            <section key={company.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <Link href={`/admin/companies/${company.id}`} className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-950">{company.name}{company.is_demo ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Demo</span> : null}</h2>
                  <p className="mt-1 text-sm text-slate-500">{company.slug ?? 'slug saknas'} · {company.industry_type ?? 'bransch saknas'} · {company.operational_model ?? 'modell saknas'}</p>
                  <p className="mt-2 text-xs text-slate-500">{company.company_memberships?.length ?? 0} användare · {company.tasks?.length ?? 0} uppdrag · {company.resource_assets?.length ?? 0} resurser · {company.planning_runs?.length ?? 0} planeringskörningar</p>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lifecycle} tone={tone(lifecycle)} />
                  <StatusBadge status={company.status} />
                  {company.is_demo ? (
                    <>
                      <form action={archiveDemoCompanyAction}>
                        <input type="hidden" name="company_id" value={company.id} />
                        <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Arkivera demo</button>
                      </form>
                      <form action={deleteDemoCompanyAction}>
                        <input type="hidden" name="company_id" value={company.id} />
                        <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">Ta bort demodata</button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
              <form action={updateCompanyGovernanceAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[180px_1fr_auto]">
                <input type="hidden" name="company_id" value={company.id} />
                <select name="lifecycle_status" defaultValue={lifecycle} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="pending_approval">Väntar godkännande</option>
                  <option value="active">Aktiv</option>
                  <option value="paused">Pausad</option>
                  <option value="rejected">Nekad</option>
                  <option value="archived">Arkiverad</option>
                </select>
                <input name="approval_note" defaultValue={company.approval_note ?? ''} placeholder="Intern kommentar / orsak" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Spara status</button>
              </form>
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}
