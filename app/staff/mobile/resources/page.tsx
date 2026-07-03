export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createExtraResourceUsageAction, updateResourceAssignmentStatusAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

function todayBounds() {
  const date = new Date().toISOString().slice(0, 10)
  return { start: `${date}T00:00:00`, end: `${date}T23:59:59`, date }
}

function statusTone(status: string | null | undefined) {
  if (['picked_up', 'returned', 'extra_added'].includes(status ?? '')) return 'success' as const
  if (['not_picked_up', 'issue_reported'].includes(status ?? '')) return 'danger' as const
  if (['replaced', 'planned'].includes(status ?? '')) return 'warning' as const
  return 'neutral' as const
}

function canPreviewCompanyResources(role: string | null | undefined) {
  return ['company_admin', 'operations_manager', 'planner', 'supervisor', 'dispatcher', 'team_lead'].includes(role ?? '')
}

type ResourceActionButtonsProps = {
  assignment: any
  resources: any[]
  returnPath: string
}

function ResourceActionButtons({ assignment, resources, returnPath }: ResourceActionButtonsProps) {
  const status = assignment.status ?? 'planned'
  return (
    <div className="mt-4 grid gap-3">
      {status === 'planned' || status === 'not_picked_up' || status === 'issue_reported' ? (
        <form action={updateResourceAssignmentStatusAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="action_type" value="picked_up" />
          <input type="hidden" name="return_path" value={returnPath} />
          <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Jag har tagit resursen</button>
        </form>
      ) : null}

      {status !== 'returned' ? (
        <form action={updateResourceAssignmentStatusAction} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="return_path" value={returnPath} />
          <select name="action_type" defaultValue="issue_reported" className={selectClassName}>
            <option value="not_picked_up">Jag kunde inte ta resursen</option>
            <option value="replaced">Jag tog annan resurs istället</option>
            <option value="issue_reported">Rapportera problem</option>
            <option value="cancelled">Resursen behövs inte</option>
          </select>
          <select name="reason_code" defaultValue="not_available" className={selectClassName}>
            <option value="not_available">Fanns ej på plats</option>
            <option value="held_by_other">Annan person har den</option>
            <option value="damaged">Trasig/skadad</option>
            <option value="used_replacement">Tog annan resurs</option>
            <option value="not_needed">Behövs inte längre</option>
            <option value="other">Annat</option>
          </select>
          <select name="replacement_resource_asset_id" className={selectClassName}>
            <option value="">Ersättningsresurs, om relevant</option>
            {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
          </select>
          <input name="comment" className={inputClassName} placeholder="Kort kommentar" />
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Spara avvikelse</button>
        </form>
      ) : null}

      {['picked_up', 'replaced', 'issue_reported'].includes(status) ? (
        <form action={updateResourceAssignmentStatusAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="action_type" value="returned" />
          <input type="hidden" name="return_path" value={returnPath} />
          <button className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Avlämnad / återlämnad</button>
        </form>
      ) : null}
    </div>
  )
}

export default async function MobileResourcesPage() {
  const auth = await requireCompanyContext()
  const { start, end, date } = todayBounds()
  const companyId = auth.membership.companyId
  const adminPreview = canPreviewCompanyResources(auth.membership.companyRole)

  const { data: staffProfile } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('membership_id', auth.membership.membershipId)
    .is('archived_at', null)
    .maybeSingle()

  if (!staffProfile && !adminPreview) {
    return (
      <AppShell auth={auth} title="Mina resurser" subtitle="Mobil kvittens för resurser.">
        <EmptyState title="Din användare saknar personalprofil" description="Be admin koppla din inloggning till en personalprofil. Då visas dagens resurser och uppdrag här." />
      </AppShell>
    )
  }

  let assignmentQuery = supabaseAdmin
    .from('planning_resource_assignments')
    .select('id, resource_asset_id, actual_resource_asset_id, task_id, planned_start_at, planned_end_at, status, assignment_kind, note, picked_up_at, returned_at, planned_staff_profile_id, planned_team_id')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .lt('planned_start_at', end)
    .gt('planned_end_at', start)
    .order('planned_start_at')

  if (staffProfile) assignmentQuery = assignmentQuery.eq('planned_staff_profile_id', staffProfile.id)

  const [{ data: assignments }, { data: resources }, { data: tasks }, { data: staff }, { data: teams }] = await Promise.all([
    assignmentQuery,
    supabaseAdmin.from('resource_assets').select('id, name, status').eq('company_id', companyId).is('archived_at', null).order('name').limit(500),
    supabaseAdmin.from('tasks').select('id, title, scheduled_start, scheduled_end').eq('company_id', companyId).is('archived_at', null).order('scheduled_start').limit(200),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', companyId).is('archived_at', null).order('full_name').limit(500),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', companyId).is('archived_at', null).order('name').limit(300),
  ])

  const resourceById = new Map((resources ?? []).map((row: any) => [row.id, row.name]))
  const taskById = new Map((tasks ?? []).map((row: any) => [row.id, row.title]))
  const staffById = new Map((staff ?? []).map((row: any) => [row.id, row.full_name]))
  const teamById = new Map((teams ?? []).map((row: any) => [row.id, row.name]))
  const todayTasks = (tasks ?? []).filter((task: any) => {
    const value = task.scheduled_start ?? task.scheduled_end
    return value ? String(value).startsWith(date) : true
  })

  const title = staffProfile ? 'Mina resurser' : 'Mobil resursvy'
  const subtitle = staffProfile
    ? `Dagens resursansvar för ${staffProfile.full_name ?? 'personal'}.`
    : 'Adminförhandsvisning av dagens resursansvar. Koppla en användare till personalprofil för verklig personalvy.'

  return (
    <AppShell auth={auth} title={title} subtitle={subtitle} actions={<Link href="/staff/mobile/day" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Min dag</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <section className="space-y-4">
          {assignments?.length ? assignments.map((assignment: any) => {
            const planned = resourceById.get(assignment.resource_asset_id) ?? 'Resurs'
            const actual = assignment.actual_resource_asset_id && assignment.actual_resource_asset_id !== assignment.resource_asset_id ? resourceById.get(assignment.actual_resource_asset_id) : null
            const responsible = staffById.get(assignment.planned_staff_profile_id) ?? teamById.get(assignment.planned_team_id) ?? 'Ingen ansvarig'
            return (
              <section key={assignment.id} className="coordiqo-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{assignment.assignment_kind === 'extra' ? 'Extra resurs' : 'Planerad resurs'} · {responsible}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">{planned}{actual ? ` → ${actual}` : ''}</h2>
                    <p className="mt-2 text-sm text-slate-600">{taskById.get(assignment.task_id) ?? assignment.note ?? 'Ingen uppdragskoppling'}</p>
                    <p className="mt-1 text-xs text-slate-400">{assignment.planned_start_at ? new Date(assignment.planned_start_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'start saknas'}–{assignment.planned_end_at ? new Date(assignment.planned_end_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'slut saknas'}</p>
                  </div>
                  <StatusBadge status={assignment.status} tone={statusTone(assignment.status)} />
                </div>
                <ResourceActionButtons assignment={assignment} resources={resources ?? []} returnPath="/staff/mobile/resources" />
              </section>
            )
          }) : <EmptyState title="Inga planerade resurser idag" description="Om personal tar en resurs ändå kan den läggas till som extra resurs här." />}
        </section>

        <aside className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Lägg till extra resurs</h2>
          <p className="mt-1 text-sm text-slate-500">Använd när personal tog en cykel, bil, nyckel eller annan resurs som inte fanns i planeringen.</p>
          <form action={createExtraResourceUsageAction} className="mt-4 grid gap-4">
            <input type="hidden" name="return_path" value="/staff/mobile/resources" />
            {!staffProfile ? <Field label="Personal"><select name="staff_profile_id" required className={selectClassName}><option value="">Välj personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field> : null}
            <Field label="Resurs"><select name="resource_asset_id" required className={selectClassName}><option value="">Välj resurs</option>{resources?.map((resource: any) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.status}</option>)}</select></Field>
            <Field label="Koppla till uppdrag, valfritt"><select name="task_id" className={selectClassName}><option value="">Ingen uppdragskoppling</option>{todayTasks.map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
            <Field label="Orsak"><select name="reason_code" defaultValue="extra_resource" className={selectClassName}><option value="extra_resource">Extra hjälpmedel</option><option value="used_replacement">Planerad resurs saknades</option><option value="needed_for_task">Behövdes för uppdrag</option><option value="other">Annat</option></select></Field>
            <Field label="Kommentar"><textarea name="comment" className={textareaClassName} placeholder="Ex. jag tog Cykel 3 eftersom bilen var upptagen" /></Field>
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till och bekräfta hämtad</button>
          </form>
        </aside>
      </div>
    </AppShell>
  )
}
