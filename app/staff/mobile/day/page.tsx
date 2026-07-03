export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { createDeviationAction, createMobileExecutionEventAction } from '@/lib/engines/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

function todayBounds() {
  const date = new Date().toISOString().slice(0, 10)
  return { start: `${date}T00:00:00`, end: `${date}T23:59:59` }
}

function canPreviewCompanyDay(role: string | null | undefined) {
  return ['company_admin', 'operations_manager', 'planner', 'supervisor', 'dispatcher', 'team_lead'].includes(role ?? '')
}

type ResourceOption = { id: string; name: string }
type StaffOption = { id: string; full_name: string }
type TeamOption = { id: string; name: string }
type ResourceAssignment = {
  id: string
  resource_asset_id: string | null
  actual_resource_asset_id: string | null
  task_id: string | null
  status: string
}
type AssignmentRow = {
  id: string
  task_id: string
  planned_start_at: string | null
  planned_end_at: string | null
  status: string
  staff_profile_id: string | null
  team_id: string | null
  tasks: { title: string; entities: { name: string } | null } | null
}

export default async function MobileDayPage() {
  const auth = await requireCompanyContext()
  const { start, end } = todayBounds()
  const companyId = auth.membership.companyId
  const adminPreview = canPreviewCompanyDay(auth.membership.companyRole)
  const { data: staffProfile } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('membership_id', auth.membership.membershipId)
    .is('archived_at', null)
    .maybeSingle()

  if (!staffProfile && !adminPreview) {
    return (
      <AppShell auth={auth} title="Min dag" subtitle="Mobil vy för dagens uppdrag och resurser.">
        <EmptyState title="Din användare saknar personalprofil" description="Be admin koppla din inloggning till en personalprofil. Då visas dagens planering här." />
      </AppShell>
    )
  }

  let assignmentQuery = supabaseAdmin
    .from('task_assignments')
    .select('id, task_id, planned_start_at, planned_end_at, status, staff_profile_id, team_id, tasks(title, entities(name))')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .lt('planned_start_at', end)
    .gt('planned_end_at', start)
    .order('planned_start_at')

  let resourceAssignmentQuery = supabaseAdmin
    .from('planning_resource_assignments')
    .select('id, resource_asset_id, actual_resource_asset_id, task_id, planned_start_at, planned_end_at, status, assignment_kind, planned_staff_profile_id, planned_team_id')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .lt('planned_start_at', end)
    .gt('planned_end_at', start)
    .order('planned_start_at')

  if (staffProfile) {
    assignmentQuery = assignmentQuery.eq('staff_profile_id', staffProfile.id)
    resourceAssignmentQuery = resourceAssignmentQuery.eq('planned_staff_profile_id', staffProfile.id)
  }

  const [{ data: assignments }, { data: resourceAssignments }, { data: resources }, { data: staff }, { data: teams }] = await Promise.all([
    assignmentQuery,
    resourceAssignmentQuery,
    supabaseAdmin.from('resource_assets').select('id, name').eq('company_id', companyId).is('archived_at', null).limit(500),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', companyId).is('archived_at', null).limit(500),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', companyId).is('archived_at', null).limit(300),
  ])
  const resourceRows = (resources ?? []) as ResourceOption[]
  const staffRows = (staff ?? []) as StaffOption[]
  const teamRows = (teams ?? []) as TeamOption[]
  const assignmentRows = (assignments ?? []) as unknown as AssignmentRow[]
  const resourceAssignmentRows = (resourceAssignments ?? []) as ResourceAssignment[]
  const resourceById = new Map(resourceRows.map((row) => [row.id, row.name]))
  const staffById = new Map(staffRows.map((row) => [row.id, row.full_name]))
  const teamById = new Map(teamRows.map((row) => [row.id, row.name]))
  const resourcesByTask = new Map<string, ResourceAssignment[]>()
  for (const resource of resourceAssignmentRows) {
    if (!resource.task_id) continue
    const list = resourcesByTask.get(resource.task_id) ?? []
    list.push(resource)
    resourcesByTask.set(resource.task_id, list)
  }

  const title = staffProfile ? 'Min dag' : 'Mobil dagvy'
  const subtitle = staffProfile
    ? `Dagens planering för ${staffProfile.full_name ?? 'personal'}.`
    : 'Adminförhandsvisning av dagens personalplanering. Koppla användaren till personalprofil för verklig mobilvy.'

  return (
    <AppShell auth={auth} title={title} subtitle={subtitle} actions={<Link href="/staff/mobile/resources" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Mina resurser</Link>}>
      <div className="space-y-4">
        {assignmentRows.length ? assignmentRows.map((assignment) => {
          const taskResources = resourcesByTask.get(assignment.task_id) ?? []
          const responsible = (assignment.staff_profile_id ? staffById.get(assignment.staff_profile_id) : null) ?? (assignment.team_id ? teamById.get(assignment.team_id) : null) ?? 'Ingen ansvarig'
          return (
            <section key={assignment.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{assignment.planned_start_at ? new Date(assignment.planned_start_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'start saknas'}–{assignment.planned_end_at ? new Date(assignment.planned_end_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'slut saknas'} · {responsible}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{assignment.tasks?.title ?? 'Uppdrag'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{assignment.tasks?.entities?.name ?? 'Ingen plats/objekt'}</p>
                </div>
                <StatusBadge status={assignment.status} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Resurser för uppdraget</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {taskResources.length ? taskResources.map((resource) => <Link key={resource.id} href="/staff/mobile/resources" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{resourceById.get(resource.actual_resource_asset_id ?? resource.resource_asset_id ?? '') ?? 'Resurs'} · {resource.status}</Link>) : <span className="text-sm text-slate-500">Inga resurskrav för detta uppdrag.</span>}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <form action={createMobileExecutionEventAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="task_id" value={assignment.task_id} />
                  <input type="hidden" name="task_assignment_id" value={assignment.id} />
                  <button name="event_type" value="on_way" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">På väg</button>
                  <button name="event_type" value="arrived" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Framme</button>
                  <button name="event_type" value="started" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Starta</button>
                  <button name="event_type" value="completed" className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Klar</button>
                </form>
                <form action={createDeviationAction} className="flex gap-2">
                  <input type="hidden" name="task_id" value={assignment.task_id} />
                  <input type="hidden" name="priority" value="high" />
                  <input name="title" placeholder="Rapportera avvikelse" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs" />
                  <button className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white">Skicka</button>
                </form>
              </div>
            </section>
          )
        }) : <EmptyState title="Inga uppdrag idag" description="När planeringen publiceras visas dagens uppdrag och kopplade resurser här." />}
      </div>
    </AppShell>
  )
}
