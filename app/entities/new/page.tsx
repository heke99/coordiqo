export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createEntityAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewEntityPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: entityTypes }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('entity_types').select('id, label_singular, label_plural, code').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])

  return (
    <AppShell auth={auth} title="Skapa objekt" subtitle="Skapa objekt utifrån företagets branschstyrda objekttyper.">
      <FormCard title="Objektuppgifter" description="Detta är den generella kärnmodellen. Branschspecifika fält byggs ovanpå via dynamiska fält i senare batchar.">
        <form action={createEntityAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Objekttyp"><select name="entity_type_id" required className={selectClassName}><option value="">Välj objekttyp</option>{entityTypes?.map((type) => <option key={type.id} value={type.id}>{type.label_singular}</option>)}</select></Field>
          <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Exempelvis Fastighet A, Hyresgäst B eller Kund C" /></Field>
          <Field label="Externt ID"><input name="external_id" className={inputClassName} placeholder="Kundnummer, lägenhets-ID, objektnummer" /></Field>
          <Field label="Team"><select name="primary_team_id" className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
          <Field label="Prioritet"><select name="priority" defaultValue="normal" className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
          <div className="sm:col-span-2"><Field label="Sammanfattning"><textarea name="summary" className={textareaClassName} placeholder="Kort sammanfattning av objektet" /></Field></div>
          <div className="sm:col-span-2"><Field label="Instruktioner"><textarea name="instructions" className={textareaClassName} placeholder="Portkod, nyckelinfo, särskilda instruktioner eller arbetsregler" /></Field></div>
          <Field label="Gatuadress"><input name="street" className={inputClassName} /></Field>
          <Field label="Postnummer"><input name="postal_code" className={inputClassName} /></Field>
          <Field label="Ort"><input name="city" className={inputClassName} /></Field>
          <Field label="Accessinstruktion"><input name="access_instructions" className={inputClassName} /></Field>
          <Field label="Kontaktperson"><input name="contact_name" className={inputClassName} /></Field>
          <Field label="Kontaktroll"><input name="contact_role" className={inputClassName} placeholder="Hyresgäst, kund, anhörig, kontaktperson" /></Field>
          <Field label="Kontakt e-post"><input name="contact_email" type="email" className={inputClassName} /></Field>
          <Field label="Kontakt telefon"><input name="contact_phone" className={inputClassName} /></Field>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa objekt</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
