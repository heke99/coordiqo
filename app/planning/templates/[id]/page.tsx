export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createPlanningRunFromTemplateAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

function minutesLabel(minutes: number | null | undefined) {
  const value = Number(minutes ?? 0)
  if (value >= 60) return `${Math.round(value / 60)} h`
  return `${value} min`
}

export default async function PlanningTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyContext()
  const { id } = await params

  const [{ data: template }, { data: items }, { data: applications }] = await Promise.all([
    supabaseAdmin
      .from('planning_templates')
      .select('*')
      .eq('id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('planning_template_items')
      .select('id, title, priority, offset_days, start_time, duration_minutes, sort_order, staff_profiles(full_name), teams(name), tasks(title)')
      .eq('planning_template_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('sort_order'),
    supabaseAdmin
      .from('planning_template_applications')
      .select('id, planning_run_id, applied_date_from, applied_date_to, status, skipped_count, conflict_count, created_at')
      .eq('planning_template_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!template) notFound()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell
      auth={auth}
      title={template.name}
      subtitle="Återanvändbar planeringsmall. Den skapar alltid ett utkast först, aldrig direktpublicering."
      actions={<Link href="/planning/templates" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Alla mallar</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <section className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{template.description ?? 'Ingen beskrivning'}</p>
                <p className="mt-2 text-xs text-slate-400">Period: {template.default_date_span_days ?? 1} dag(ar) · Typ: {template.template_type}</p>
              </div>
              <StatusBadge status={template.status} />
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Mallrader</h2>
            <div className="mt-4 space-y-3">
              {items?.length ? items.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">Dag +{item.offset_days ?? 0} · {String(item.start_time ?? '').slice(0, 5) || 'tid saknas'} · {minutesLabel(item.duration_minutes)}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.staff_profiles?.full_name ?? item.teams?.name ?? 'Ingen person/team låst'} · {item.tasks?.title ?? 'Uppdrag'}</p>
                    </div>
                    <StatusBadge status={item.priority ?? 'normal'} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Mallen saknar rader.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skapa nytt utkast</h2>
            <form action={createPlanningRunFromTemplateAction} className="mt-4 grid gap-4">
              <input type="hidden" name="template_id" value={template.id} />
              <Field label="Namn"><input name="name" className={inputClassName} placeholder={`${template.name} · ${today}`} /></Field>
              <Field label="Startdatum"><input name="date_from" type="date" required defaultValue={today} className={inputClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa planeringsutkast</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Historik</h2>
            <div className="mt-4 space-y-3">
              {applications?.length ? applications.map((application: any) => (
                <Link key={application.id} href={application.planning_run_id ? `/planning/runs/${application.planning_run_id}` : `/planning/templates/${template.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{application.applied_date_from} – {application.applied_date_to}</p>
                      <p className="mt-1 text-xs text-slate-500">Skippade {application.skipped_count ?? 0} · konflikter {application.conflict_count ?? 0}</p>
                    </div>
                    <StatusBadge status={application.status} />
                  </div>
                </Link>
              )) : <p className="text-sm text-slate-600">Ingen historik ännu.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
