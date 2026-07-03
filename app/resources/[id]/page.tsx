export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveResourceAction, updateResourceAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

function statusTone(status: string | null | undefined) {
  if (['picked_up', 'returned'].includes(status ?? '')) return 'success' as const
  if (['not_picked_up', 'issue_reported'].includes(status ?? '')) return 'danger' as const
  if (['replaced', 'planned'].includes(status ?? '')) return 'warning' as const
  return 'neutral' as const
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyContext()
  const { id } = await params
  const [{ data: resource }, { data: types }, { data: staff }, { data: teams }, { data: assignments }, { data: events }, { data: deviations }, { data: tasks }] = await Promise.all([
    supabaseAdmin.from('resource_assets').select('*, resource_types(name)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin
      .from('planning_resource_assignments')
      .select('id, resource_asset_id, actual_resource_asset_id, planned_staff_profile_id, planned_team_id, task_id, planned_start_at, planned_end_at, status, assignment_kind, note, picked_up_at, returned_at, last_event_at, created_at')
      .eq('company_id', auth.membership.companyId)
      .or(`resource_asset_id.eq.${id},actual_resource_asset_id.eq.${id}`)
      .is('archived_at', null)
      .order('planned_start_at', { ascending: false })
      .limit(80),
    supabaseAdmin
      .from('resource_usage_events')
      .select('id, resource_assignment_id, resource_asset_id, actual_resource_asset_id, event_type, staff_profile_id, task_id, reason_code, comment, event_at')
      .eq('company_id', auth.membership.companyId)
      .or(`resource_asset_id.eq.${id},actual_resource_asset_id.eq.${id}`)
      .order('event_at', { ascending: false })
      .limit(80),
    supabaseAdmin
      .from('resource_deviations')
      .select('id, resource_assignment_id, deviation_type, description, status, created_at, staff_profile_id, replacement_resource_asset_id')
      .eq('company_id', auth.membership.companyId)
      .eq('resource_asset_id', id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabaseAdmin.from('tasks').select('id, title').eq('company_id', auth.membership.companyId).is('archived_at', null).limit(500),
  ])
  if (!resource) notFound()

  const staffById = new Map((staff ?? []).map((row: any) => [row.id, row.full_name]))
  const teamById = new Map((teams ?? []).map((row: any) => [row.id, row.name]))
  const taskById = new Map((tasks ?? []).map((row: any) => [row.id, row.title]))

  return (
    <AppShell auth={auth} title={resource.name} subtitle="Resursdetaljer, ansvar, bekräftelser, avvikelser och historik." actions={<Link href="/resources" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Alla resurser</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <section className="space-y-5">
          <FormCard title="Redigera resurs">
            <form action={updateResourceAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={resource.id} />
              <Field label="Namn"><input name="name" required defaultValue={resource.name} className={inputClassName} /></Field>
              <Field label="Resurstyp"><select name="resource_type_id" defaultValue={resource.resource_type_id ?? ''} className={selectClassName}><option value="">Välj typ</option>{types?.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
              <Field label="Asset tag / ID"><input name="asset_tag" defaultValue={resource.asset_tag ?? ''} className={inputClassName} /></Field>
              <Field label="Status"><select name="status" defaultValue={resource.status} className={selectClassName}><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="lost">Förlorad</option><option value="inactive">Inaktiv</option></select></Field>
              <Field label="Standardansvarig personal"><select name="assigned_staff_id" defaultValue={resource.assigned_staff_id ?? ''} className={selectClassName}><option value="">Ingen person</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
              <Field label="Standardteam"><select name="assigned_team_id" defaultValue={resource.assigned_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
              <Field label="Standardplats"><input name="location_label" defaultValue={resource.location_label ?? ''} className={inputClassName} /></Field>
              <Field label="Återlämning"><select name="requires_return" defaultValue={resource.requires_return === false ? 'off' : 'on'} className={selectClassName}><option value="on">Personal ska markera avlämnad</option><option value="off">Avlämning krävs inte</option></select></Field>
              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-700"><input name="allow_overlapping" type="checkbox" defaultChecked={Boolean(resource.allow_overlapping)} className="mt-1" /><span><b>Tillåt delad/dubbel användning</b><br />Använd bara när flera kan använda samma resurs samtidigt.</span></label>
              </div>
              <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" defaultValue={resource.notes ?? ''} className={textareaClassName} /></Field></div>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Planerat ansvar och faktisk användning</h2>
            <div className="mt-4 space-y-3">
              {assignments?.length ? assignments.map((assignment: any) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{staffById.get(assignment.planned_staff_profile_id) ?? teamById.get(assignment.planned_team_id) ?? 'Ingen ansvarig'}</p>
                      <p className="mt-1 text-sm text-slate-500">{taskById.get(assignment.task_id) ?? assignment.note ?? 'ingen uppdragskoppling'} · {assignment.assignment_kind}</p>
                      <p className="mt-1 text-xs text-slate-400">{assignment.planned_start_at ? new Date(assignment.planned_start_at).toLocaleString('sv-SE') : 'start saknas'} – {assignment.planned_end_at ? new Date(assignment.planned_end_at).toLocaleString('sv-SE') : 'slut saknas'}</p>
                    </div>
                    <StatusBadge status={assignment.status} tone={statusTone(assignment.status)} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Ingen planerad eller rapporterad användning ännu.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={resource.status} /></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{resource.resource_types?.name ?? 'Resurs'} · {resource.asset_tag ?? 'ingen tagg'} · {resource.location_label ?? 'ingen plats'}</p>
            <p className="mt-2 text-xs text-slate-500">{resource.requires_return ? 'Personal ska markera avlämnad.' : 'Avlämning krävs inte.'} {resource.allow_overlapping ? 'Kan delas samtidigt.' : 'Dubbelbokning stoppas/varnas i planeringen.'}</p>
            <form action={archiveResourceAction} className="mt-4"><input type="hidden" name="id" value={resource.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera resurs</button></form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Händelser</h2>
            <div className="mt-4 space-y-3">
              {events?.length ? events.map((event: any) => <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4"><StatusBadge status={event.event_type} tone={statusTone(event.event_type)} /><p className="mt-2 text-sm text-slate-600">{staffById.get(event.staff_profile_id) ?? 'Okänd personal'} · {taskById.get(event.task_id) ?? 'ingen uppgift'}</p>{event.comment ? <p className="mt-1 text-sm text-slate-500">{event.comment}</p> : null}<p className="mt-1 text-xs text-slate-400">{new Date(event.event_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Inga händelser ännu.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Avvikelser</h2>
            <div className="mt-4 space-y-3">
              {deviations?.length ? deviations.map((deviation: any) => <div key={deviation.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><StatusBadge status={deviation.status} tone="warning" /><p className="mt-2 font-semibold text-amber-950">{deviation.deviation_type}</p>{deviation.description ? <p className="mt-1 text-sm text-amber-900">{deviation.description}</p> : null}<p className="mt-1 text-xs text-amber-800">{staffById.get(deviation.staff_profile_id) ?? 'Okänd personal'} · {new Date(deviation.created_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Inga avvikelser.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
