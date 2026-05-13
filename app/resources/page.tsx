
export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageResources } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { createResourceTypeAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Field, inputClassName, textareaClassName } from '@/components/ui/form-card'

type ResourcesPageProps = { searchParams?: Promise<{ q?: string; status?: string }> }

function startOfToday() {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00`
}

function endOfToday() {
  return `${new Date().toISOString().slice(0, 10)}T23:59:59`
}

function statusTone(status: string | null | undefined) {
  if (['picked_up', 'returned'].includes(status ?? '')) return 'success' as const
  if (['not_picked_up', 'issue_reported'].includes(status ?? '')) return 'danger' as const
  if (['replaced', 'planned'].includes(status ?? '')) return 'warning' as const
  return 'neutral' as const
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params?.q?.trim() ?? ''
  const requestedStatus = params?.status ?? 'all'
  const validStatuses = new Set(['all', 'available', 'assigned', 'maintenance', 'lost', 'inactive', 'archived'])
  const status = validStatuses.has(requestedStatus) ? requestedStatus : 'all'
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  let query = supabaseAdmin
    .from('resource_assets')
    .select('id, name, asset_tag, status, location_label, requires_return, allow_overlapping, resource_types(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('name')

  if (status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`name.ilike.%${q}%,asset_tag.ilike.%${q}%,location_label.ilike.%${q}%`)

  const [{ data: resources, error }, { data: assignments }, { data: types }, { data: staff }, { data: teams }, { data: tasks }] = await Promise.all([
    query,
    supabaseAdmin
      .from('planning_resource_assignments')
      .select('id, resource_asset_id, actual_resource_asset_id, planned_staff_profile_id, planned_team_id, task_id, planned_start_at, planned_end_at, status, assignment_kind, note, last_event_at')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .lt('planned_start_at', todayEnd)
      .gt('planned_end_at', todayStart)
      .order('planned_start_at'),
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).limit(500),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).limit(300),
    supabaseAdmin.from('tasks').select('id, title').eq('company_id', auth.membership.companyId).is('archived_at', null).limit(500),
  ])
  const canManage = canManageResources(auth.membership.companyRole)
  const staffById = new Map((staff ?? []).map((row: any) => [row.id, row.full_name]))
  const teamById = new Map((teams ?? []).map((row: any) => [row.id, row.name]))
  const taskById = new Map((tasks ?? []).map((row: any) => [row.id, row.title]))
  const resourceById = new Map((resources ?? []).map((row: any) => [row.id, row.name]))
  const assignmentsByResource = new Map<string, any[]>()
  for (const assignment of assignments ?? []) {
    const key = (assignment as any).actual_resource_asset_id ?? (assignment as any).resource_asset_id
    if (!key) continue
    const current = assignmentsByResource.get(key) ?? []
    current.push(assignment)
    assignmentsByResource.set(key, current)
  }

  return (
    <AppShell auth={auth} title="Resurser" subtitle="Branschneutral resursmotor för nycklar, bilar, cyklar, maskiner, verktyg, passerkort och annan utrustning.">
      <div className="space-y-5">
        <SearchFilter action="/resources" defaultValue={q} placeholder="Sök resurs, tagg eller plats" newHref={canManage ? '/resources/new' : undefined} newLabel="Skapa resurs">
          <select name="status" defaultValue={status} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="all">Alla statusar</option><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="lost">Förlorad</option><option value="inactive">Inaktiv</option>
          </select>
        </SearchFilter>

        <section className="coordiqo-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Dagens resursstatus</h2>
              <p className="mt-1 text-sm text-slate-500">Snabb översikt över planerat ansvar, bekräftelser, ersättningar och avvikelser idag.</p>
            </div>
            <Link href="/staff/mobile/resources" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Mobil resursvy</Link>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {assignments?.length ? assignments.map((assignment: any) => {
              const plannedResource = resourceById.get(assignment.resource_asset_id) ?? 'Resurs'
              const actualResource = assignment.actual_resource_asset_id && assignment.actual_resource_asset_id !== assignment.resource_asset_id ? resourceById.get(assignment.actual_resource_asset_id) : null
              return (
                <Link key={assignment.id} href={assignment.resource_asset_id ? `/resources/${assignment.resource_asset_id}` : '/resources'} className="block rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{plannedResource}{actualResource ? ` → ${actualResource}` : ''}</p>
                      <p className="mt-1 text-sm text-slate-500">{staffById.get(assignment.planned_staff_profile_id) ?? teamById.get(assignment.planned_team_id) ?? 'Ingen ansvarig'} · {taskById.get(assignment.task_id) ?? assignment.note ?? 'ingen uppdragskoppling'}</p>
                      <p className="mt-1 text-xs text-slate-400">{assignment.planned_start_at ? new Date(assignment.planned_start_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'start saknas'}–{assignment.planned_end_at ? new Date(assignment.planned_end_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'slut saknas'} · {assignment.assignment_kind}</p>
                    </div>
                    <StatusBadge status={assignment.status} tone={statusTone(assignment.status)} />
                  </div>
                </Link>
              )
            }) : <p className="text-sm text-slate-600">Inga resurser är planerade idag.</p>}
          </div>
        </section>

        {canManage ? (
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skapa egen resurstyp</h2>
            <p className="mt-1 text-sm text-slate-500">Använd standardtyperna eller skapa egna typer som passar företagets bransch.</p>
            <form action={createResourceTypeAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
              <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Ex. Lift, städvagn, servicebil" /></Field>
              <Field label="Kod"><input name="code" className={inputClassName} placeholder="valfritt" /></Field>
              <Field label="Beskrivning"><input name="description" className={inputClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa typ</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">{types?.map((type: any) => <span key={type.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{type.name}</span>)}</div>
          </section>
        ) : null}

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!resources?.length ? (
          <EmptyState eyebrow="Batch 8F" title="Lägg in första resursen" description="Resurser kan vara nycklar, bilar, cyklar, verktyg, maskiner, passerkort, medicinsk utrustning eller andra branschspecifika objekt. Planeringsmotorn kan sedan skapa ansvar och personalen kan kvittera i mobilen." action={canManage ? <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/resources/new">Skapa resurs</Link> : undefined} />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource: any) => {
              const todaysAssignments = assignmentsByResource.get(resource.id) ?? []
              return (
                <Link key={resource.id} href={`/resources/${resource.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-medium text-slate-500">{resource.resource_types?.name ?? 'Resurs'}</p><h2 className="mt-2 text-lg font-semibold text-slate-950">{resource.name}</h2></div>
                    <StatusBadge status={resource.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{resource.asset_tag ?? 'Ingen tagg'} · {resource.location_label ?? 'Ingen plats'}</p>
                  <p className="mt-2 text-sm text-slate-500">{todaysAssignments.length ? `${todaysAssignments.length} planerade ansvar idag` : 'Ingen planerad användning idag'}</p>
                  <p className="mt-2 text-xs text-slate-400">{resource.requires_return ? 'Kräver avlämning' : 'Ingen avlämning krävs'} · {resource.allow_overlapping ? 'kan delas' : 'dubbelbokas ej'}</p>
                </Link>
              )
            })}
          </section>
        )}
      </div>
    </AppShell>
  )
}
