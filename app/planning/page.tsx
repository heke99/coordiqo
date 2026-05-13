export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { resolvePlanningConflictAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PlanningPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: runs }, { data: drafts }, { data: conflicts }, { data: assignments }] = await Promise.all([
    supabaseAdmin.from('planning_runs').select('id, name, status, date_from, date_to, created_at, summary').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('planning_drafts').select('id, title, status, date_from, date_to, created_at, summary, summary_json, conflict_summary, planning_run_id').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('planning_conflicts').select('id, conflict_type, severity, status, message, created_at, tasks(title), staff_profiles(full_name)').eq('company_id', auth.membership.companyId).eq('status', 'open').is('archived_at', null).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('task_assignments').select('id, status, planned_start_at, planned_end_at, is_locked, tasks(title), staff_profiles(full_name), teams(name)').eq('company_id', auth.membership.companyId).is('archived_at', null).order('planned_start_at', { ascending: true }).limit(10),
  ])

  return (
    <AppShell
      auth={auth}
      title="Planering"
      subtitle="Batch 8A–8E: AI-assistent, planeringskörningar, återanvändbara mallar, projektkoppling, kandidater och konflikter."
      actions={<div className="flex gap-2"><Link href="/planning/assistant" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">AI-assistent</Link><Link href="/planning/templates" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Mallar</Link><Link href="/planning/runs/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny planeringskörning</Link></div>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Körningar</p><p className="mt-2 text-3xl font-semibold text-slate-950">{runs?.length ?? 0}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Utkast</p><p className="mt-2 text-3xl font-semibold text-slate-950">{drafts?.length ?? 0}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Öppna konflikter</p><p className="mt-2 text-3xl font-semibold text-slate-950">{conflicts?.length ?? 0}</p></div>
          </div>

          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Senaste utkast</h2>
              <Link href="/planning/runs" className="text-sm font-semibold text-slate-950">Alla körningar →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {drafts?.length ? drafts.map((draft: any) => (
                <Link key={draft.id} href={draft.planning_run_id ? `/planning/runs/${draft.planning_run_id}` : '/planning'} className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{draft.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{draft.date_from ?? 'datum saknas'} – {draft.date_to ?? draft.date_from ?? 'datum saknas'}</p>
                      <p className="mt-2 text-xs text-slate-500">{draft.summary_json?.draftItems ?? 0} rader · {draft.conflict_summary?.hard ?? 0} hårda konflikter · {draft.conflict_summary?.soft ?? 0} mjuka</p>
                    </div>
                    <StatusBadge status={draft.status} />
                  </div>
                </Link>
              )) : <EmptyState eyebrow="Batch 8A" title="Inga planeringsutkast ännu" description="Skapa första planeringskörningen för att generera kandidater och konflikter." action={<Link href="/planning/runs/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa körning</Link>} />}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Publicerade / manuella tilldelningar</h2>
            <div className="mt-4 space-y-3">
              {assignments?.length ? assignments.map((assignment: any) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{assignment.tasks?.title ?? 'Uppdrag'}</p>
                      <p className="mt-1 text-sm text-slate-500">{assignment.staff_profiles?.full_name ?? assignment.teams?.name ?? 'Ej namngiven'} · {new Date(assignment.planned_start_at).toLocaleString('sv-SE')}</p>
                    </div>
                    <div className="flex gap-2"><StatusBadge status={assignment.status} />{assignment.is_locked ? <StatusBadge status="låst" tone="warning" /> : null}</div>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga tilldelningar ännu.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Öppna konflikter</h2>
            <div className="mt-4 space-y-3">
              {conflicts?.length ? conflicts.map((conflict: any) => (
                <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-950">{conflict.message}</p>
                      <p className="mt-1 text-xs text-amber-800">{conflict.tasks?.title ?? 'Uppdrag'} · {conflict.staff_profiles?.full_name ?? 'ingen personal'} · {conflict.conflict_type}</p>
                    </div>
                    <StatusBadge status={conflict.severity} tone={['hard', 'critical', 'blocked'].includes(conflict.severity) ? 'danger' : 'warning'} />
                  </div>
                  <form action={resolvePlanningConflictAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="id" value={conflict.id} />
                    <select name="resolution_type" defaultValue="resolved" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900"><option value="resolved">Löst</option><option value="override">Override</option><option value="accept_risk">Acceptera risk</option><option value="ignore">Ignorera</option></select>
                    <input name="reason" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900" placeholder="Kort orsak" />
                    <button className="rounded-xl bg-amber-900 px-3 py-2 text-xs font-semibold text-white">Markera</button>
                  </form>
                </div>
              )) : <p className="text-sm text-slate-600">Inga öppna konflikter.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
