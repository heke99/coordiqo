export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { ResourceRequirementPanel } from '@/components/resources/resource-requirement-panel'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { approveProjectCalculationRunAction, createProjectActualsAction, createProjectCalculationRunAction } from '@/lib/engines/actions'
import { createPlanningRunAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

function hours(minutes: number | null | undefined) {
  return Math.round(Number(minutes ?? 0) / 60)
}

function money(value: number | null | undefined, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value ?? 0))
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: project }, { data: phases }, { data: workItems }, { data: tasks }, { data: runs }, { data: calculationRuns }, { data: actuals }, { data: resourceTypes }, { data: resources }, { data: resourceRequirements }] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('*, entities(display_name), project_templates(name)')
      .eq('id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('sort_order'),
    supabaseAdmin
      .from('project_work_items')
      .select('*, project_phases(name), tasks(title, status)')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('sort_order'),
    supabaseAdmin
      .from('tasks')
      .select('id, title, status, estimated_duration_minutes, scheduled_start, scheduled_end, assigned_staff_id, assigned_team_id, staff_profiles(full_name), teams(name)')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('planning_runs')
      .select('id, name, status, date_from, date_to, created_at, summary')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('project_calculation_runs')
      .select('id, version, status, currency, estimated_minutes, internal_cost, recommended_price, margin_percent, risk_markup_percent, created_at')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('project_actuals')
      .select('id, status, actual_minutes, actual_cost, actual_billing_amount, actual_margin_amount, deadline_status, customer_satisfaction, created_at')
      .eq('project_id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('resource_assets').select('id, name, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(300),
    supabaseAdmin.from('resource_requirements').select('id, requirement_label, quantity, is_hard_requirement, description, resource_assets(name), resource_types(name)').eq('company_id', auth.membership.companyId).eq('owner_type', 'project').eq('owner_id', id).is('archived_at', null).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()
  const today = new Date().toISOString().slice(0, 10)
  const latestCalculation = (calculationRuns ?? [])[0] as { id: string; version: number; status: string; currency: string; estimated_minutes: number; internal_cost: number; recommended_price: number; margin_percent: number; risk_markup_percent: number; created_at: string } | undefined
  const projectActuals = actuals as { id: string; status: string; actual_minutes: number; actual_cost: number; actual_billing_amount: number; actual_margin_amount: number; deadline_status: string | null; customer_satisfaction: number | null } | null

  return (
    <AppShell
      auth={auth}
      title={project.name}
      subtitle="Projektets kalkyl, arbetsmoment, genererade uppdrag och koppling till planeringsmotorn."
      actions={<Link href="/projects" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Alla projekt</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <section className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{project.entities?.display_name ?? 'Inget objekt'} · {project.project_templates?.name ?? 'Egen mall'} · {project.planned_workers ?? 1} personal</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{project.description ?? 'Ingen beskrivning.'}</p>
              </div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><StatusBadge status={project.priority} /></div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Arbetstid</p><p className="mt-1 text-2xl font-semibold text-slate-950">{hours(project.estimated_effort_minutes)} h</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Schematid</p><p className="mt-1 text-2xl font-semibold text-slate-950">{hours(project.estimated_calendar_minutes)} h</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Material</p><p className="mt-1 text-2xl font-semibold text-slate-950">{money(project.estimated_material_cost, project.currency)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total</p><p className="mt-1 text-2xl font-semibold text-slate-950">{money(project.estimated_total_cost, project.currency)}</p></div>
            </div>
          </section>

          <ResourceRequirementPanel
            ownerType="project"
            ownerId={project.id}
            returnPath={`/projects/${project.id}`}
            title="Resurser som behövs för projektet"
            description="Lägg resurser som behövs för hela projektet, till exempel servicebil, maskin, verktyg eller passerkort. Projektets uppdrag ärver detta i planeringen."
            resourceTypes={resourceTypes ?? []}
            resources={resources ?? []}
            requirements={resourceRequirements ?? []}
          />

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Arbetsmoment</h2>
            <div className="mt-4 space-y-3">
              {workItems?.length ? workItems.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.project_phases?.name ?? 'Fas'} · {item.quantity ?? 1} {item.unit_label ?? ''} · {hours(item.estimated_effort_minutes)} h arbete</p>
                      <p className="mt-1 text-xs text-slate-400">Uppdrag: {item.tasks?.title ?? 'ej skapat'} · {item.tasks?.status ?? 'saknas'}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga arbetsmoment ännu.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Genererade uppdrag</h2>
            <div className="mt-4 space-y-3">
              {tasks?.length ? tasks.map((task: any) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{hours(task.estimated_duration_minutes)} h · {task.staff_profiles?.full_name ?? task.teams?.name ?? 'ej tilldelad'}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                </Link>
              )) : <p className="text-sm text-slate-600">Inga uppdrag skapade för projektet.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Projektkalkyl</h2>
            <p className="mt-1 text-sm text-slate-500">Coordiqo räknar. AI kan föreslå, men kalkylen godkänns av ansvarig.</p>
            <form action={createProjectCalculationRunAction} className="mt-4 grid gap-3">
              <input type="hidden" name="project_id" value={project.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Timkostnad"><input name="labor_rate" type="number" defaultValue="550" className={inputClassName} /></Field>
                <Field label="Marginal %"><input name="margin_percent" type="number" defaultValue="30" className={inputClassName} /></Field>
                <Field label="Risk %"><input name="risk_markup_percent" type="number" defaultValue="10" className={inputClassName} /></Field>
              </div>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa kalkyl</button>
            </form>
            {latestCalculation ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">Version {latestCalculation.version}</p>
                    <p className="mt-1 text-sm text-slate-500">{hours(latestCalculation.estimated_minutes)} h · kostnad {money(latestCalculation.internal_cost, latestCalculation.currency)} · pris {money(latestCalculation.recommended_price, latestCalculation.currency)}</p>
                  </div>
                  <StatusBadge status={latestCalculation.status} />
                </div>
                {latestCalculation.status !== 'approved' ? (
                  <form action={approveProjectCalculationRunAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="id" value={latestCalculation.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input name="approval_reason" required placeholder="Orsak till godkännande" className={inputClassName} />
                    <button className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Godkänn kalkyl</button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Efterkalkyl och lärande</h2>
            {projectActuals ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{hours(projectActuals.actual_minutes)} h faktisk tid</p>
                    <p className="mt-1 text-sm text-slate-500">Kostnad {money(projectActuals.actual_cost, project.currency)} · debitering {money(projectActuals.actual_billing_amount, project.currency)} · marginal {money(projectActuals.actual_margin_amount, project.currency)}</p>
                  </div>
                  <StatusBadge status={projectActuals.status} />
                </div>
              </div>
            ) : null}
            <form action={createProjectActualsAction} className="mt-4 grid gap-3">
              <input type="hidden" name="project_id" value={project.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Faktiska timmar"><input name="actual_hours" type="number" step="0.25" className={inputClassName} /></Field>
                <Field label="Faktisk kostnad"><input name="actual_cost" type="number" className={inputClassName} /></Field>
                <Field label="Debiterat"><input name="actual_billing_amount" type="number" className={inputClassName} /></Field>
                <Field label="Kundnöjdhet 1-5"><input name="customer_satisfaction" type="number" min="1" max="5" defaultValue="3" className={inputClassName} /></Field>
              </div>
              <Field label="Deadline"><select name="deadline_status" defaultValue="on_time" className={selectClassName}><option value="on_time">I tid</option><option value="late">Försenad</option><option value="early">Före deadline</option></select></Field>
              <Field label="Lärdom"><input name="notes" className={inputClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara efterkalkyl</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skicka till planeringsmotor</h2>
            <p className="mt-1 text-sm text-slate-500">Skapar ett planeringsutkast filtrerat på projektets oschemalagda uppdrag.</p>
            <form action={createPlanningRunAction} className="mt-4 grid gap-4">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="unscheduled_only" value="true" />
              <Field label="Namn"><input name="name" defaultValue={`Planering · ${project.name}`} className={inputClassName} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Från"><input name="date_from" type="date" required defaultValue={project.target_start_date ?? today} className={inputClassName} /></Field>
                <Field label="Till"><input name="date_to" type="date" required defaultValue={project.deadline_date ?? project.target_start_date ?? today} className={inputClassName} /></Field>
              </div>
              <Field label="Låsta tilldelningar"><select name="include_locked_assignments" defaultValue="true" className={selectClassName}><option value="true">Ta hänsyn till låsta</option><option value="false">Ignorera låsta i urval</option></select></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa planeringsutkast</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Planeringskörningar</h2>
            <div className="mt-4 space-y-3">
              {runs?.length ? runs.map((run: any) => (
                <Link key={run.id} href={`/planning/runs/${run.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{run.name}</p>
                      <p className="mt-1 text-slate-500">{run.date_from} – {run.date_to}</p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                </Link>
              )) : <p className="text-sm text-slate-600">Ingen planeringskörning ännu.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Faser</h2>
            <div className="mt-4 space-y-2">
              {phases?.length ? phases.map((phase: any) => <div key={phase.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm"><b>{phase.name}</b><span className="block text-xs text-slate-500">{hours(phase.estimated_effort_minutes)} h · {phase.status}</span></div>) : <p className="text-sm text-slate-600">Inga faser.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
