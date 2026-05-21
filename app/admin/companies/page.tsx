export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { updateCompanyGovernanceAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

function tone(status: string | null | undefined) {
  if (status === 'active') return 'success' as const
  if (status === 'pending_approval' || status === 'paused') return 'warning' as const
  if (status === 'rejected' || status === 'archived') return 'danger' as const
  return 'neutral' as const
}

export default async function AdminCompaniesPage() {
  const auth = await requireAuth()
  if (!isPlatformAdminRole(auth.platformRole)) redirect('/dashboard')

  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, name, slug, status, lifecycle_status, industry_type, operational_model, approval_note, created_at, company_memberships(id, status), tasks(id), resources(id), planning_runs(id)')
    .order('created_at', { ascending: false })

  return (
    <AppShell auth={auth} title="Bolag" subtitle="Superadminvy för att godkänna, pausa, arkivera och följa upp tenant-bolag.">
      <div className="space-y-4">
        {(companies ?? []).map((company: any) => {
          const lifecycle = company.lifecycle_status ?? (company.status === 'active' ? 'active' : 'paused')
          return (
            <section key={company.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <Link href={`/admin/companies/${company.id}`} className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-950">{company.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{company.slug ?? 'slug saknas'} · {company.industry_type ?? 'bransch saknas'} · {company.operational_model ?? 'modell saknas'}</p>
                  <p className="mt-2 text-xs text-slate-500">{company.company_memberships?.length ?? 0} användare · {company.tasks?.length ?? 0} uppdrag · {company.resources?.length ?? 0} resurser · {company.planning_runs?.length ?? 0} planeringskörningar</p>
                </Link>
                <div className="flex flex-wrap gap-2"><StatusBadge status={lifecycle} tone={tone(lifecycle)} /><StatusBadge status={company.status} /></div>
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
