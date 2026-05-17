export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { getIndustryPreset } from '@/lib/industry/config'
import { buildDailyOperationsSummary, getIndustryTaskFocus, getStopLabel, groupAssignmentsByRoute, getTaskSortTime } from '@/lib/operations/operations-engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

function dateBounds(date: string) {
  return {
    start: `${date}T00:00:00.000Z`,
    end: `${date}T23:59:59.999Z`,
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function stat(label: string, value: number, tone: string = 'bg-white') {
  return <div className={`rounded-3xl border border-slate-200 ${tone} p-4`}><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p></div>
}

export default async function TodayOperationsPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const selectedDate = params?.date ?? new Date().toISOString().slice(0, 10)
  const bounds = dateBounds(selectedDate)
  const preset = getIndustryPreset(auth.membership.industryType)

  const [{ data: assignments }, { data: tasks }, { data: resourceAssignments }, { data: deviations }, { data: conflicts }] = await Promise.all([
    supabaseAdmin
      .from('task_assignments')
      .select('id, task_id, staff_profile_id, team_id, planned_start_at, planned_end_at, status, staff_profiles(full_name, transport_mode), teams(name), tasks(id, title, status, priority, scheduled_start, scheduled_end, time_window_start, time_window_end, estimated_duration_minutes, custom_fields, entities(name), task_types(name))')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .lt('planned_start_at', bounds.end)
      .gt('planned_end_at', bounds.start)
      .order('planned_start_at', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('tasks')
      .select('id, title, status, priority, scheduled_start, scheduled_end, time_window_start, time_window_end, estimated_duration_minutes, custom_fields, entities(name), task_types(name)')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .or(`scheduled_start.gte.${bounds.start},time_window_start.gte.${bounds.start}`)
      .or(`scheduled_start.lte.${bounds.end},time_window_start.lte.${bounds.end}`)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('planning_resource_assignments')
      .select('id, task_id, planned_staff_profile_id, planned_team_id, planned_start_at, planned_end_at, status, resource_assets(name, resource_types(name)), actual_resource_assets:resource_assets!planning_resource_assignments_actual_resource_asset_id_fkey(name), staff_profiles:staff_profiles!planning_resource_assignments_planned_staff_profile_id_fkey(full_name), teams:teams!planning_resource_assignments_planned_team_id_fkey(name), tasks(title)')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .lt('planned_start_at', bounds.end)
      .gt('planned_end_at', bounds.start)
      .order('planned_start_at', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('resource_deviations')
      .select('id, deviation_type, description, created_at, staff_profiles(full_name), resource_assets(name)')
      .eq('company_id', auth.membership.companyId)
      .gte('created_at', bounds.start)
      .lte('created_at', bounds.end)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('planning_conflicts')
      .select('id, severity, status, conflict_type, message, created_at')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const assignmentRows = (assignments ?? []) as any[]
  const taskRows = (tasks ?? []) as any[]
  const resourceRows = (resourceAssignments ?? []) as any[]
  const deviationRows = (deviations ?? []) as any[]
  const summary = buildDailyOperationsSummary({ assignments: assignmentRows, tasks: taskRows, resourceAssignments: resourceRows, deviations: deviationRows })
  const routes = groupAssignmentsByRoute(assignmentRows as any)
  const unassignedTasks = taskRows.filter((task) => !assignmentRows.some((assignment) => assignment.task_id === task.id) && !['completed', 'cancelled', 'archived'].includes(task.status ?? '')).sort((a, b) => getTaskSortTime(a).localeCompare(getTaskSortTime(b)))

  return (
    <AppShell
      auth={auth}
      title="Daglig operationsvy"
      subtitle={`Kontrollpanel för ${preset.shortLabel.toLowerCase()} med ${getIndustryTaskFocus(auth.membership.industryType)}.`}
      actions={<div className="flex gap-2"><Link href="/planning/assistant" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">AI-planera</Link><Link href="/resources" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Resurser</Link></div>}
    >
      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-950">Datum</p><input type="date" name="date" defaultValue={selectedDate} className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400" /></div>
          <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Visa dag</button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        {stat(preset.terminology.tasks, summary.totalTasks)}
        {stat('Tilldelningar', summary.totalAssignments)}
        {stat('Aktiva', summary.activeAssignments)}
        {stat('Klara', summary.completedAssignments)}
        {stat('Oplanerade', summary.unassignedTasks, summary.unassignedTasks ? 'bg-amber-50' : 'bg-white')}
        {stat('Sena', summary.lateItems, summary.lateItems ? 'bg-red-50' : 'bg-white')}
        {stat('Resursproblem', summary.resourceIssues, summary.resourceIssues ? 'bg-red-50' : 'bg-white')}
        {stat('Ej kvitterade', summary.unconfirmedResources, summary.unconfirmedResources ? 'bg-amber-50' : 'bg-white')}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="coordiqo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-950">Dagens {preset.terminology.route.toLowerCase()}</h2><p className="mt-1 text-sm text-slate-600">Grupperat per personal/team med stopp i tidsordning.</p></div>
            <StatusBadge status={`${routes.length} rutter`} />
          </div>
          <div className="mt-5 space-y-4">
            {routes.length ? routes.map((route) => (
              <div key={route.key} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-slate-950">{route.title}</h3><p className="mt-1 text-xs text-slate-500">{route.stopCount} stopp · {route.transportMode ?? 'färdsätt ej satt'} · {formatTime(route.startAt)}–{formatTime(route.endAt)}</p></div>
                  <StatusBadge status={route.key.startsWith('staff') ? preset.terminology.staff : 'Team'} />
                </div>
                <div className="mt-4 space-y-2">
                  {route.rows.map((assignment: any, index: number) => (
                    <Link href={`/tasks/${assignment.task_id}`} key={assignment.id} className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:bg-white">
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">{assignment.tasks?.title ?? 'Uppdrag'}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatTime(assignment.planned_start_at)}–{formatTime(assignment.planned_end_at)} · {getStopLabel(assignment.tasks)}</p>
                        </div>
                        <StatusBadge status={assignment.status ?? assignment.tasks?.status ?? 'planerad'} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )) : <EmptyState eyebrow="Operations" title="Ingen publicerad plan för dagen" description="Kör AI-planeraren eller skapa manuella tilldelningar så visas rutterna här." action={<Link href="/planning/assistant" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Öppna AI-planerare</Link>} />}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Resursstatus idag</h2>
            <div className="mt-4 space-y-3">
              {resourceRows.length ? resourceRows.slice(0, 10).map((row: any) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">{row.resource_assets?.name ?? 'Resurs'}</p><p className="mt-1 text-xs text-slate-500">{row.staff_profiles?.full_name ?? row.teams?.name ?? 'Ej ansvarig'} · {row.tasks?.title ?? 'Extra resurs'}</p></div><StatusBadge status={row.status ?? 'planned'} /></div>
                  {row.actual_resource_assets?.name && row.actual_resource_assets.name !== row.resource_assets?.name ? <p className="mt-2 text-xs font-semibold text-amber-700">Ersatt med {row.actual_resource_assets.name}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-600">Inga resursansvar idag.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Avvikelser och konflikter</h2>
            <div className="mt-4 space-y-3">
              {deviationRows.slice(0, 5).map((deviation: any) => <div key={deviation.id} className="rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-900">{deviation.resource_assets?.name ?? 'Resurs'} · {deviation.deviation_type ?? 'avvikelse'}</p><p className="mt-1 text-xs text-red-700">{deviation.staff_profiles?.full_name ?? 'Okänd'} · {deviation.description ?? 'Ingen kommentar'}</p></div>)}
              {(conflicts ?? []).slice(0, 5).map((conflict: any) => <div key={conflict.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">{conflict.conflict_type}</p><p className="mt-1 text-xs text-amber-800">{conflict.message}</p></div>)}
              {!deviationRows.length && !(conflicts ?? []).length ? <p className="text-sm text-slate-600">Inga öppna avvikelser eller konflikter.</p> : null}
            </div>
          </section>
        </aside>
      </div>

      <section className="coordiqo-card mt-5 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Oplanerade {preset.terminology.tasks.toLowerCase()}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {unassignedTasks.length ? unassignedTasks.slice(0, 12).map((task: any) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-950">{task.title}</p><StatusBadge status={task.priority ?? 'normal'} /></div>
              <p className="mt-2 text-xs text-slate-500">{task.task_types?.name ?? preset.terminology.task} · {formatTime(task.scheduled_start ?? task.time_window_start)} · {getStopLabel(task)}</p>
            </Link>
          )) : <p className="text-sm text-slate-600">Inga oplanerade uppdrag i dag.</p>}
        </div>
      </section>
    </AppShell>
  )
}
