export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveStaffAction, updateStaffAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: person }, { data: teams }, { data: resources }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('*').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('resource_assets').select('id, name, status').eq('company_id', auth.membership.companyId).eq('assigned_staff_id', id).is('archived_at', null).order('name'),
  ])

  if (!person) notFound()

  return (
    <AppShell auth={auth} title={person.full_name} subtitle="Personalprofil, team, färdsätt och operativ status.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <FormCard title="Redigera personalprofil">
          <form action={updateStaffAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={person.id} />
            <Field label="Namn"><input name="full_name" required defaultValue={person.full_name} className={inputClassName} /></Field>
            <Field label="E-post"><input name="email" type="email" defaultValue={person.email ?? ''} className={inputClassName} /></Field>
            <Field label="Telefon"><input name="phone" defaultValue={person.phone ?? ''} className={inputClassName} /></Field>
            <Field label="Anställnings-ID"><input name="employee_id" defaultValue={person.employee_id ?? ''} className={inputClassName} /></Field>
            <Field label="Titel"><input name="job_title" defaultValue={person.job_title ?? ''} className={inputClassName} /></Field>
            <Field label="Primärt team"><select name="primary_team_id" defaultValue={person.primary_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Personaltyp"><select name="staff_kind" defaultValue={person.staff_kind} className={selectClassName}><option value="staff">Personal</option><option value="contractor">Entreprenör</option><option value="manager">Chef</option><option value="planner">Planerare</option><option value="supervisor">Supervisor</option><option value="external">Extern</option></select></Field>
            <Field label="Anställningsform"><select name="employment_type" defaultValue={person.employment_type ?? 'unspecified'} className={selectClassName}><option value="unspecified">Ej specificerad</option><option value="full_time">Heltid</option><option value="part_time">Deltid</option><option value="hourly">Timanställd</option><option value="contractor">Konsult/entreprenör</option><option value="temporary">Vikarie/tillfällig</option></select></Field>
            <Field label="Färdsätt"><select name="transport_mode" defaultValue={person.transport_mode} className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="none">Ej relevant</option></select></Field>
            <Field label="Status"><select name="status" defaultValue={person.status} className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
            <Field label="Startplats"><input name="start_address" defaultValue={person.start_address ?? ''} className={inputClassName} /></Field>
            <Field label="Slutplats"><input name="end_address" defaultValue={person.end_address ?? ''} className={inputClassName} /></Field>
            <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" defaultValue={person.notes ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
          </form>
        </FormCard>

        <div className="space-y-5">
          <section className="coordiqo-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={person.status} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete. Personens historik bevaras inför senare planerings- och auditflöden.</p><form action={archiveStaffAction} className="mt-4"><input type="hidden" name="id" value={person.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera personal</button></form></section>
          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Tilldelade resurser</h2><div className="mt-4 space-y-3">{resources?.length ? resources.map((resource) => <div key={resource.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{resource.name}</p><p className="mt-1 text-sm text-slate-500">{resource.status}</p></div>) : <p className="text-sm text-slate-600">Inga resurser är kopplade till personen ännu.</p>}</div></section>
        </div>
      </div>
    </AppShell>
  )
}
