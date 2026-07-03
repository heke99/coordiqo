export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createTeamAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewTeamPage() {
  const auth = await requireCompanyContext()

  const { data: staff } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('full_name')

  return (
    <AppShell auth={auth} title="Skapa team" subtitle="Team används för ansvar, planering och framtida områdesstyrning.">
      <FormCard title="Teamuppgifter">
        <form action={createTeamAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Namn"><input name="name" required className={inputClassName} /></Field>
          <Field label="Kod"><input name="code" className={inputClassName} /></Field>
          <Field label="Område/zon"><input name="area_label" className={inputClassName} placeholder="Exempel: Stockholm syd" /></Field>
          <Field label="Teamledare"><select name="team_lead_staff_profile_id" className={selectClassName}><option value="">Ingen teamledare</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
          <Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
          <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa team</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
