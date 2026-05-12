export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveResourceAction, updateResourceAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params
  const [{ data: resource }, { data: types }, { data: staff }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('resource_assets').select('*').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])
  if (!resource) notFound()

  return (
    <AppShell auth={auth} title={resource.name} subtitle="Resursdetaljer, status, tilldelning och arkivering.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <FormCard title="Redigera resurs">
          <form action={updateResourceAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={resource.id} />
            <Field label="Namn"><input name="name" required defaultValue={resource.name} className={inputClassName} /></Field>
            <Field label="Resurstyp"><select name="resource_type_id" defaultValue={resource.resource_type_id ?? ''} className={selectClassName}><option value="">Välj typ</option>{types?.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
            <Field label="Asset tag / ID"><input name="asset_tag" defaultValue={resource.asset_tag ?? ''} className={inputClassName} /></Field>
            <Field label="Status"><select name="status" defaultValue={resource.status} className={selectClassName}><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="lost">Förlorad</option><option value="inactive">Inaktiv</option></select></Field>
            <Field label="Tilldela till personal"><select name="assigned_staff_id" defaultValue={resource.assigned_staff_id ?? ''} className={selectClassName}><option value="">Ingen person</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Tilldela till team"><select name="assigned_team_id" defaultValue={resource.assigned_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Plats"><input name="location_label" defaultValue={resource.location_label ?? ''} className={inputClassName} /></Field>
            <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" defaultValue={resource.notes ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
          </form>
        </FormCard>
        <section className="coordiqo-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={resource.status} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Arkivera om resursen inte ska användas i planering. Historik och audit sparas.</p><form action={archiveResourceAction} className="mt-4"><input type="hidden" name="id" value={resource.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera resurs</button></form></section>
      </div>
    </AppShell>
  )
}
