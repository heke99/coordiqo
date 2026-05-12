export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createStaffAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewStaffPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name')

  return (
    <AppShell auth={auth} title="Skapa personal" subtitle="Skapa en operativ personalprofil som senare kan schemaläggas och matchas mot uppdrag.">
      <FormCard title="Personaluppgifter" description="Du kan koppla profilen till ett inloggningskonto senare via invite-flödet.">
        <form action={createStaffAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Namn"><input name="full_name" required className={inputClassName} placeholder="Anna Andersson" /></Field>
          <Field label="E-post"><input name="email" type="email" className={inputClassName} placeholder="anna@bolag.se" /></Field>
          <Field label="Telefon"><input name="phone" className={inputClassName} placeholder="070..." /></Field>
          <Field label="Anställnings-ID"><input name="employee_id" className={inputClassName} placeholder="EMP-001" /></Field>
          <Field label="Titel"><input name="job_title" className={inputClassName} placeholder="Fastighetstekniker" /></Field>
          <Field label="Primärt team"><select name="primary_team_id" className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Personaltyp"><select name="staff_kind" defaultValue="staff" className={selectClassName}><option value="staff">Personal</option><option value="contractor">Entreprenör</option><option value="manager">Chef</option><option value="planner">Planerare</option><option value="supervisor">Supervisor</option><option value="external">Extern</option></select></Field>
          <Field label="Anställningsform"><select name="employment_type" defaultValue="unspecified" className={selectClassName}><option value="unspecified">Ej specificerad</option><option value="full_time">Heltid</option><option value="part_time">Deltid</option><option value="hourly">Timanställd</option><option value="contractor">Konsult/entreprenör</option><option value="temporary">Vikarie/tillfällig</option></select></Field>
          <Field label="Färdsätt"><select name="transport_mode" defaultValue="car" className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="none">Ej relevant</option></select></Field>
          <Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
          <Field label="Startplats"><input name="start_address" className={inputClassName} placeholder="Utgångsadress" /></Field>
          <Field label="Slutplats"><input name="end_address" className={inputClassName} placeholder="Slutadress" /></Field>
          <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" className={textareaClassName} placeholder="Interna planeringsnoteringar" /></Field></div>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa personalprofil</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
