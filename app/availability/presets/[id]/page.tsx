export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { archiveShiftPresetAction, updateShiftPresetAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function timeValue(value: string | null) {
  return value ? String(value).slice(0, 5) : ''
}

export default async function ShiftPresetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params
  const [{ data: preset }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('shift_presets').select('*').eq('id', id).eq('company_id', auth.membership.companyId).eq('preset_scope', 'company').is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])
  if (!preset) notFound()

  return (
    <AppShell auth={auth} title={preset.name} subtitle="Redigera företagets egna passpreset. Systempresets kopieras först innan de kan ändras.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
        <FormCard title="Redigera preset">
          <form action={updateShiftPresetAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={preset.id} />
            <Field label="Namn"><input name="name" required defaultValue={preset.name ?? ''} className={inputClassName} /></Field>
            <Field label="Typ"><input name="preset_type" defaultValue={preset.preset_type ?? 'custom'} className={inputClassName} /></Field>
            <Field label="Starttid"><input name="start_time" type="time" required defaultValue={timeValue(preset.start_time)} className={inputClassName} /></Field>
            <Field label="Sluttid"><input name="end_time" type="time" required defaultValue={timeValue(preset.end_time)} className={inputClassName} /></Field>
            <Field label="Rast minuter"><input name="break_minutes" type="number" min="0" defaultValue={preset.break_minutes ?? 0} className={inputClassName} /></Field>
            <Field label="Buffer minuter"><input name="buffer_minutes" type="number" min="0" defaultValue={preset.buffer_minutes ?? 0} className={inputClassName} /></Field>
            <Field label="Standardstatus"><select name="default_status" defaultValue={preset.default_status ?? 'draft'} className={selectClassName}><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option></select></Field>
            <Field label="Färdsätt"><select name="transport_mode" defaultValue={preset.transport_mode ?? 'car'} className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="electric_vehicle">Elbil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="mixed">Mixat</option></select></Field>
            <Field label="Standardteam"><select name="default_team_id" defaultValue={preset.default_team_id ?? ''} className={selectClassName}><option value="">Inget</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Favorit"><select name="is_favorite" defaultValue={preset.is_favorite ? 'true' : 'false'} className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>
            <Field label="Startplats"><select name="start_location_type" defaultValue={preset.start_location_type ?? 'company_base'} className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="first_task">Första uppdraget</option></select></Field>
            <Field label="Slutplats"><select name="end_location_type" defaultValue={preset.end_location_type ?? 'company_base'} className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="last_task">Sista uppdraget</option></select></Field>
            <Field label="Min bemanning"><input name="min_staff" type="number" min="0" defaultValue={preset.min_staff ?? ''} className={inputClassName} /></Field>
            <Field label="Max bemanning"><input name="max_staff" type="number" min="0" defaultValue={preset.max_staff ?? ''} className={inputClassName} /></Field>
            <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" defaultValue={preset.description ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara preset</button></div>
          </form>
        </FormCard>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Användning</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Den här preseten kan användas i snabbflödet på Schema för att skapa pass för flera personal eller team över datumintervall.</p>
          <a href={`/schedule?preset=${preset.id}`} className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Använd i schema</a>
          <form action={archiveShiftPresetAction} className="mt-5 border-t border-slate-200 pt-5">
            <input type="hidden" name="id" value={preset.id} />
            <button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">Arkivera preset</button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
