export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createShiftPresetAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewShiftPresetPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { data: teams } = await supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name')

  return (
    <AppShell auth={auth} title="Ny passpreset" subtitle="Skapa en egen företagspreset. Den visas tillsammans med Coordiqos branschpresets vid snabb- och bulkplanering.">
      <FormCard title="Preset" description="Du kan skapa helt egna tider, namn och standardvärden. Detta låser inte företaget till våra systempresets.">
        <form action={createShiftPresetAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Team Syd morgon" /></Field>
          <Field label="Typ"><input name="preset_type" className={inputClassName} placeholder="custom, care, cleaning..." defaultValue="custom" /></Field>
          <Field label="Starttid"><input name="start_time" type="time" required className={inputClassName} /></Field>
          <Field label="Sluttid"><input name="end_time" type="time" required className={inputClassName} /></Field>
          <Field label="Rast minuter"><input name="break_minutes" type="number" min="0" defaultValue="30" className={inputClassName} /></Field>
          <Field label="Buffer minuter"><input name="buffer_minutes" type="number" min="0" defaultValue="15" className={inputClassName} /></Field>
          <Field label="Standardstatus"><select name="default_status" defaultValue="draft" className={selectClassName}><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option></select></Field>
          <Field label="Färdsätt"><select name="transport_mode" defaultValue="car" className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="electric_vehicle">Elbil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="mixed">Mixat</option></select></Field>
          <Field label="Standardteam"><select name="default_team_id" className={selectClassName}><option value="">Inget</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
          <Field label="Favorit"><select name="is_favorite" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>
          <Field label="Startplats"><select name="start_location_type" defaultValue="company_base" className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="first_task">Första uppdraget</option></select></Field>
          <Field label="Slutplats"><select name="end_location_type" defaultValue="company_base" className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="last_task">Sista uppdraget</option></select></Field>
          <Field label="Min bemanning"><input name="min_staff" type="number" min="0" className={inputClassName} /></Field>
          <Field label="Max bemanning"><input name="max_staff" type="number" min="0" className={inputClassName} /></Field>
          <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div>
          <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa preset</button></div>
        </form>
      </FormCard>
    </AppShell>
  )
}
