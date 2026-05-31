export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { approveOptimizationRunAction, runOptimizationAction } from '@/lib/engines/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type OptimizationRunRow = {
  id: string
  plan_label: string
  provider: string
  status: string
  blocking_count: number
  warning_count: number
  summary: { taskCount?: number; plannedStops?: number; unassigned?: number } | null
  created_at: string
}

type OptimizationItemRow = {
  id: string
  optimization_run_id: string
  stop_order: number | null
  travel_seconds: number
  distance_meters: number
  status: string
  tasks: { title: string } | null
  staff_profiles: { full_name: string } | null
}

type UnassignedRow = {
  id: string
  reason_code: string
  severity: string
  tasks: { title: string } | null
}

export default async function OptimizationPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const companyId = auth.membership.companyId
  const [{ data: runs }, { data: items }, { data: unassigned }, { count: taskCount }] = await Promise.all([
    supabaseAdmin.from('optimization_runs').select('id, plan_label, provider, status, blocking_count, warning_count, summary, created_at').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(6),
    supabaseAdmin.from('optimization_run_items').select('id, optimization_run_id, stop_order, travel_seconds, distance_meters, status, tasks(title), staff_profiles(full_name)').eq('company_id', companyId).is('archived_at', null).order('stop_order').limit(80),
    supabaseAdmin.from('optimization_unassigned_jobs').select('id, reason_code, severity, tasks(title)').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).in('status', ['new', 'open', 'planned', 'draft', 'assigned']),
  ])

  const runRows = (runs ?? []) as OptimizationRunRow[]
  const itemRows = (items ?? []) as unknown as OptimizationItemRow[]
  const unassignedRows = (unassigned ?? []) as unknown as UnassignedRow[]
  const latestRun = runRows[0]
  const latestItems = latestRun ? itemRows.filter((item) => item.optimization_run_id === latestRun.id) : []

  return (
    <AppShell
      auth={auth}
      title="Optimering"
      subtitle="Skapa Plan A/B/C, se stoppordning, restid, avstånd, varningar och jobb som inte kunde planeras."
      actions={<Link href="/planning" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Till planering</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Kör optimering</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Extern optimering används när den är kopplad. Annars skapas en säker intern plan baserad på tidsfönster, prioritet och koordinater.</p>
            <form action={runOptimizationAction} className="mt-5 grid gap-4">
              <Field label="Plan">
                <select name="plan_label" defaultValue="Plan A" className={selectClassName}>
                  <option>Plan A</option>
                  <option>Plan B</option>
                  <option>Plan C</option>
                </select>
              </Field>
              <Field label="Optimeringstyp">
                <select name="provider" defaultValue={process.env.VROOM_API_URL ? 'vroom' : 'fallback'} className={selectClassName}>
                  <option value="fallback">Intern optimering</option>
                  <option value="vroom">Extern optimering</option>
                </select>
              </Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Kör optimering</button>
            </form>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Planerbara uppdrag</p><p className="mt-2 text-3xl font-semibold text-slate-950">{taskCount ?? 0}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Optimeringskörningar</p><p className="mt-2 text-3xl font-semibold text-slate-950">{runRows.length}</p></div>
          </section>
        </aside>

        <section className="space-y-5">
          {latestRun ? (
            <section className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{latestRun.plan_label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{latestRun.provider} · {latestRun.summary?.plannedStops ?? 0} stopp · {latestRun.summary?.unassigned ?? 0} ej planerade</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={latestRun.status} /><StatusBadge status={`${latestRun.warning_count} varningar`} /></div>
              </div>
              {latestRun.status !== 'approved' ? (
                <form action={approveOptimizationRunAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
                  <input type="hidden" name="id" value={latestRun.id} />
                  <input name="approval_reason" required placeholder="Ansvarig orsak till godkännande" className={inputClassName} />
                  <button className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Godkänn plan</button>
                </form>
              ) : null}
            </section>
          ) : <EmptyState title="Ingen optimering ännu" description="Kör första optimeringen för att skapa en stoppordning som kan granskas och godkännas." />}

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Optimerad stoppordning</h2>
            <div className="mt-4 space-y-3">
              {latestItems.length ? latestItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stopp {item.stop_order ?? '-'}</p>
                      <p className="mt-1 font-semibold text-slate-950">{item.tasks?.title ?? 'Uppdrag'}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.staff_profiles?.full_name ?? 'Ej tilldelad'} · {Math.round(item.travel_seconds / 60)} min restid · {Math.round(item.distance_meters / 1000)} km</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga stopp att visa.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Ej planerade jobb</h2>
            <div className="mt-4 space-y-3">
              {unassignedRows.length ? unassignedRows.map((job) => (
                <div key={job.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-amber-950">{job.tasks?.title ?? 'Uppdrag'}</p>
                    <StatusBadge status={job.reason_code} tone="warning" />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga ej planerade jobb i senaste körningen.</p>}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  )
}

