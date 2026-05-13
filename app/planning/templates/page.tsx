export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, inputClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { createPlanningRunFromTemplateAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PlanningTemplatesPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: templates }, { data: applications }] = await Promise.all([
    supabaseAdmin
      .from('planning_templates')
      .select('id, name, description, template_type, status, default_date_span_days, created_at')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('planning_template_applications')
      .select('id, planning_template_id, planning_run_id, applied_date_from, applied_date_to, status, skipped_count, conflict_count, created_at, planning_templates(name)')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell
      auth={auth}
      title="Planeringsmallar"
      subtitle="Batch 8C: spara återkommande planeringsmönster och skapa nya utkast från mallar."
      actions={<Link href="/planning" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Till planering</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <section className="space-y-4">
          {templates?.length ? templates.map((template: any) => (
            <section key={template.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/planning/templates/${template.id}`} className="text-lg font-semibold text-slate-950 hover:underline">{template.name}</Link>
                  <p className="mt-1 text-sm text-slate-500">{template.description ?? 'Ingen beskrivning'} · {template.default_date_span_days ?? 1} dag(ar)</p>
                  <p className="mt-2 text-xs text-slate-400">Typ: {template.template_type}</p>
                </div>
                <StatusBadge status={template.status} />
              </div>

              <form action={createPlanningRunFromTemplateAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="template_id" value={template.id} />
                <Field label="Namn på körning"><input name="name" className={inputClassName} placeholder={`${template.name} · ${today}`} /></Field>
                <Field label="Startdatum"><input name="date_from" type="date" required defaultValue={today} className={inputClassName} /></Field>
                <div className="flex items-end"><button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa utkast</button></div>
              </form>
            </section>
          )) : (
            <EmptyState
              eyebrow="Batch 8C"
              title="Inga planeringsmallar ännu"
              description="Öppna en planeringskörning, granska utkastet och spara det som mall. Då kan samma uppdrag/personer/tider återanvändas."
              action={<Link href="/planning/runs" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Visa körningar</Link>}
            />
          )}
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Senaste användningar</h2>
            <div className="mt-4 space-y-3">
              {applications?.length ? applications.map((application: any) => (
                <Link key={application.id} href={application.planning_run_id ? `/planning/runs/${application.planning_run_id}` : '/planning/templates'} className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{application.planning_templates?.name ?? 'Mall'}</p>
                      <p className="mt-1 text-slate-500">{application.applied_date_from} – {application.applied_date_to}</p>
                      <p className="mt-1 text-xs text-slate-400">Skippade {application.skipped_count ?? 0} · konflikter {application.conflict_count ?? 0}</p>
                    </div>
                    <StatusBadge status={application.status} />
                  </div>
                </Link>
              )) : <p className="text-sm text-slate-600">Ingen mall har använts ännu.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
