export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createResourceAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewResourcePage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: types }, { data: staff }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])

  return (
    <AppShell auth={auth} title="Skapa resurs" subtitle="Registrera fordon, verktyg, nycklar eller annan utrustning.">
      <FormCard title="Resursuppgifter">
        <form action={createResourceAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Servicebil 1" /></Field>
          <Field label="Resurstyp"><select name="resource_type_id" className={selectClassName}><option value="">Välj typ</option>{types?.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
          <Field label="Asset tag / ID"><input name="asset_tag" className={inputClassName} placeholder="CAR-001" /></Field>
          <Field label="Status"><select name="status" defaultValue="available" className={selectClassName}><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="inactive">Inaktiv</option></select></Field>
          <Field label="Tilldela till personal"><select name="assigned_staff_id" className={selectClassName}><option value="">Ingen person</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
          <Field label="Tilldela till team"><select name="assigned_team_id" className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Plats"><input name="location_label" className={inputClassName} placeholder="Garage, kontor, förråd" /></Field>
          <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" className={textareaClassName} /></Field></div>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa resurs</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
