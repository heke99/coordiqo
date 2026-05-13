export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function todayBounds() {
  const date = new Date().toISOString().slice(0, 10)
  return { start: `${date}T00:00:00`, end: `${date}T23:59:59`, date }
}

export default async function MobileDayPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { start, end } = todayBounds()
  const { data: staffProfile } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name')
    .eq('company_id', auth.membership.companyId)
    .eq('membership_id', auth.membership.membershipId)
    .is('archived_at', null)
    .maybeSingle()

  if (!staffProfile) {
    return (
      <AppShell auth={auth} title="Min dag" subtitle="Mobil vy för dagens uppdrag och resurser.">
        <EmptyState title="Din användare saknar personalprofil" description="Be admin koppla din inloggning till en personalprofil. Då visas dagens planering här." />
      </AppShell>
    )
  }

  const [{ data: assignments }, { data: resourceAssignments }, { data: resources }] = await Promise.all([
    supabaseAdmin
      .from('task_assignments')
      .select('id, task_id, planned_start_at, planned_end_at, status, tasks(title, entities(name))')
      .eq('company_id', auth.membership.companyId)
      .eq('staff_profile_id', staffProfile.id)
      .is('archived_at', null)
      .lt('planned_start_at', end)
      .gt('planned_end_at', start)
      .order('planned_start_at'),
    supabaseAdmin
      .from('planning_resource_assignments')
      .select('id, resource_asset_id, actual_resource_asset_id, task_id, planned_start_at, planned_end_at, status, assignment_kind')
      .eq('company_id', auth.membership.companyId)
      .eq('planned_staff_profile_id', staffProfile.id)
      .is('archived_at', null)
      .lt('planned_start_at', end)
      .gt('planned_end_at', start)
      .order('planned_start_at'),
    supabaseAdmin.from('resource_assets').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).limit(500),
  ])
  const resourceById = new Map((resources ?? []).map((row: any) => [row.id, row.name]))
  const resourcesByTask = new Map<string, any[]>()
  for (const resource of resourceAssignments ?? []) {
    if (!resource.task_id) continue
    const list = resourcesByTask.get(resource.task_id) ?? []
    list.push(resource)
    resourcesByTask.set(resource.task_id, list)
  }

  return (
    <AppShell auth={auth} title="Min dag" subtitle={`Dagens planering för ${staffProfile.full_name ?? 'personal'}.`} actions={<Link href="/staff/mobile/resources" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Mina resurser</Link>}>
      <div className="space-y-4">
        {assignments?.length ? assignments.map((assignment: any) => {
          const taskResources = resourcesByTask.get(assignment.task_id) ?? []
          return (
            <section key={assignment.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{assignment.planned_start_at ? new Date(assignment.planned_start_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'start saknas'}–{assignment.planned_end_at ? new Date(assignment.planned_end_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'slut saknas'}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{assignment.tasks?.title ?? 'Uppdrag'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{assignment.tasks?.entities?.name ?? 'Ingen plats/objekt'}</p>
                </div>
                <StatusBadge status={assignment.status} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Resurser för uppdraget</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {taskResources.length ? taskResources.map((resource: any) => <Link key={resource.id} href="/staff/mobile/resources" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{resourceById.get(resource.actual_resource_asset_id ?? resource.resource_asset_id) ?? 'Resurs'} · {resource.status}</Link>) : <span className="text-sm text-slate-500">Inga resurskrav för detta uppdrag.</span>}
                </div>
              </div>
            </section>
          )
        }) : <EmptyState title="Inga uppdrag idag" description="När planeringen publiceras visas dagens uppdrag och kopplade resurser här." />}
      </div>
    </AppShell>
  )
}
