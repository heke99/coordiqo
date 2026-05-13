export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { bulkCreateShiftsAction, bulkUpdateShiftsAction, quickAbsenceAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function timeLabel(value: string | null) {
  return value ? String(value).slice(0, 5) : ''
}

function shiftTimeLabel(startsAt: string, endsAt: string) {
  return `${new Date(startsAt).toLocaleString('sv-SE')}–${new Date(endsAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; status?: string; preset?: string; bulk_run?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params.q?.trim()
  const date = params.date?.trim()
  const status = params.status?.trim()
  const selectedPresetId = params.preset?.trim()

  const [{ data: staff }, { data: teams }, { data: presets }, { data: bulkRun }, { data: bulkItems }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name, job_title, primary_team_id, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('shift_presets').select('*').is('archived_at', null).eq('is_active', true).or(`company_id.eq.${auth.membership.companyId},preset_scope.eq.system`).order('preset_scope').order('is_favorite', { ascending: false }).order('name'),
    params.bulk_run ? supabaseAdmin.from('shift_bulk_runs').select('*').eq('id', params.bulk_run).eq('company_id', auth.membership.companyId).maybeSingle().then((res) => res) : Promise.resolve({ data: null }),
    params.bulk_run ? supabaseAdmin.from('shift_bulk_run_items').select('id, shift_id, staff_profile_id, team_id, shift_date, status, conflict_summary, skipped_reason').eq('bulk_run_id', params.bulk_run).eq('company_id', auth.membership.companyId).limit(80).then((res) => res) : Promise.resolve({ data: [] }),
  ])

  const visiblePresets = (presets ?? []).filter((preset: any) => preset.preset_scope === 'company' || !preset.industry_type || preset.industry_type === auth.membership?.industryType)
  const selectedPreset = visiblePresets.find((preset: any) => preset.id === selectedPresetId)

  let query = supabaseAdmin
    .from('shifts')
    .select('id, title, shift_date, starts_at, ends_at, status, capacity_minutes, planned_minutes, remaining_minutes, planning_locked, staff_profiles(full_name), teams(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('starts_at', { ascending: true })
    .limit(150)
  if (date) query = query.eq('shift_date', date)
  if (status) query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q}%`)
  const { data: shifts, error } = await query

  return (
    <AppShell auth={auth} title="Schema" subtitle="Snabbt schemaflöde med branschpresets, egna presets, bulk-skapande och konfliktspår." actions={<Link href="/schedule/new" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Avancerat pass</Link>}>
      <div className="space-y-5">
        {bulkRun ? (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Bulk-skapande klart</p>
                <h2 className="mt-1 text-xl font-semibold text-emerald-950">{bulkRun.name}</h2>
                <p className="mt-2 text-sm text-emerald-800">Skapade {bulkRun.created_count} pass · skippade {bulkRun.skipped_count} · konflikter {bulkRun.conflict_count}</p>
              </div>
              <Link href="/schedule" className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900">Rensa vy</Link>
            </div>
            {bulkItems?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{bulkItems.map((item: any) => <div key={item.id} className="rounded-2xl bg-white/80 p-3 text-xs text-emerald-900"><b>{item.shift_date}</b> · {item.status}{item.conflict_summary ? <span className="block text-amber-700">{item.conflict_summary}</span> : null}{item.skipped_reason ? <span className="block text-red-700">{item.skipped_reason}</span> : null}</div>)}</div> : null}
          </section>
        ) : null}

        <FormCard title="Snabbt schema / bulk skapa pass" description="Välj en branschpreset, företagets egen preset eller 'Annat/eget pass'. Välj flera personal eller ett team och skapa många pass direkt.">
          <form action={bulkCreateShiftsAction} className="grid gap-4 lg:grid-cols-3">
            <Field label="Preset"><select name="preset_id" defaultValue={selectedPresetId ?? ''} className={selectClassName}><option value="custom">Annat / eget pass</option>{visiblePresets.map((preset: any) => <option key={preset.id} value={preset.id}>{preset.preset_scope === 'company' ? 'Egen' : 'System'} · {preset.name} · {timeLabel(preset.start_time)}-{timeLabel(preset.end_time)}</option>)}</select></Field>
            <Field label="Eget namn"><input name="custom_name" defaultValue={selectedPreset ? selectedPreset.name : ''} className={inputClassName} placeholder="Ex. Team Syd morgon" /></Field>
            <Field label="Spara eget som preset"><select name="save_custom_as_preset" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>

            <Field label="Starttid"><input name="start_time" type="time" defaultValue={timeLabel(selectedPreset?.start_time ?? null)} className={inputClassName} /></Field>
            <Field label="Sluttid"><input name="end_time" type="time" defaultValue={timeLabel(selectedPreset?.end_time ?? null)} className={inputClassName} /></Field>
            <Field label="Status"><select name="status" defaultValue={selectedPreset?.default_status ?? 'draft'} className={selectClassName}><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option></select></Field>

            <Field label="Från datum"><input name="date_from" type="date" required className={inputClassName} /></Field>
            <Field label="Till datum"><input name="date_to" type="date" required className={inputClassName} /></Field>
            <Field label="Konflikter"><select name="conflict_mode" defaultValue="skip_blocking" className={selectClassName}><option value="skip_blocking">Hoppa över konfliktpass</option><option value="create_all">Skapa alla med varning</option></select></Field>

            <Field label="Rast minuter"><input name="break_minutes" type="number" min="0" defaultValue={selectedPreset?.break_minutes ?? 30} className={inputClassName} /></Field>
            <Field label="Buffer minuter"><input name="buffer_minutes" type="number" min="0" defaultValue={selectedPreset?.buffer_minutes ?? 15} className={inputClassName} /></Field>
            <Field label="Färdsätt"><select name="transport_mode" defaultValue={selectedPreset?.transport_mode ?? 'car'} className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="electric_vehicle">Elbil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="mixed">Mixat</option></select></Field>

            <div className="lg:col-span-3 grid gap-4 lg:grid-cols-2">
              <Field label="Personal, flera val" hint="Håll cmd/ctrl för att välja flera. Systemet skapar ett pass per vald person och dag."><select name="staff_profile_ids" multiple size={Math.min(8, Math.max(4, staff?.length ?? 4))} className={selectClassName}>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}{person.job_title ? ` · ${person.job_title}` : ''}</option>)}</select></Field>
              <Field label="Team, flera val" hint="Välj team och slå på auto-fyll för att skapa pass för teammedlemmar."><select name="team_ids" multiple size={Math.min(8, Math.max(4, teams?.length ?? 4))} className={selectClassName}>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            </div>

            <Field label="Auto-fyll teammedlemmar"><select name="include_team_members" defaultValue="true" className={selectClassName}><option value="true">Ja, välj teamets personal</option><option value="false">Nej, skapa teampass eller använd bara valda personal</option></select></Field>
            <Field label="Startplats"><select name="start_location_type" defaultValue={selectedPreset?.start_location_type ?? 'company_base'} className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="first_task">Första uppdraget</option></select></Field>
            <Field label="Slutplats"><select name="end_location_type" defaultValue={selectedPreset?.end_location_type ?? 'company_base'} className={selectClassName}><option value="home">Hem</option><option value="company_base">Kontor/företagsbas</option><option value="team_base">Team-bas</option><option value="custom">Egen adress</option><option value="last_task">Sista uppdraget</option></select></Field>

            <div className="lg:col-span-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Veckodagar</p>
              <div className="flex flex-wrap gap-2">
                {[[1, 'Mån'], [2, 'Tis'], [3, 'Ons'], [4, 'Tor'], [5, 'Fre'], [6, 'Lör'], [7, 'Sön']].map(([value, label]) => <label key={value} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" name="weekdays" value={value} defaultChecked={Number(value) <= 5} className="mr-2" />{label}</label>)}
              </div>
            </div>

            <div className="lg:col-span-3"><Field label="Notering"><textarea name="notes" className={textareaClassName} placeholder="Syns på skapade pass." /></Field></div>
            <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa pass</button>
              <Link href="/availability/presets" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">Hantera presets</Link>
            </div>
          </form>
        </FormCard>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
          <section className="space-y-5">
            <SearchFilter action="/schedule" defaultValue={q} placeholder="Sök pass" newHref="/schedule/new" newLabel="Avancerat pass">
              <input name="date" type="date" defaultValue={date ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              <select name="status" defaultValue={status ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"><option value="">Alla statusar</option><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option><option value="cancelled">Avbokat</option></select>
            </SearchFilter>
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
            {shifts?.length ? <form action={bulkUpdateShiftsAction} className="space-y-3"><div className="coordiqo-card p-4"><div className="grid gap-3 sm:grid-cols-4"><select name="status" className={selectClassName}><option value="">Behåll status</option><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option><option value="cancelled">Avbokat</option></select><select name="planning_locked" className={selectClassName}><option value="">Behåll låsning</option><option value="true">Lås</option><option value="false">Lås upp</option></select><select name="archive" className={selectClassName}><option value="false">Arkivera inte</option><option value="true">Arkivera valda</option></select><button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Massändra valda</button></div></div><div className="grid gap-3">{shifts.map((shift: any) => <label key={shift.id} className="coordiqo-card block p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><input type="checkbox" name="shift_ids" value={shift.id} className="mt-1" /><div><Link href={`/schedule/${shift.id}`} className="text-base font-semibold text-slate-950 hover:underline">{shift.title ?? 'Pass'}</Link><p className="mt-1 text-sm text-slate-500">{shift.staff_profiles?.full_name ?? shift.teams?.name ?? 'Ej kopplat'} · {shiftTimeLabel(shift.starts_at, shift.ends_at)}</p><p className="mt-1 text-xs text-slate-400">Kapacitet {shift.capacity_minutes ?? 0} min · Planerat {shift.planned_minutes ?? 0} min · Kvar {shift.remaining_minutes ?? 0} min{shift.planning_locked ? ' · låst' : ''}</p></div></div><StatusBadge status={shift.status} /></div></label>)}</div></form> : <EmptyState eyebrow="Batch 7B" title="Inga pass ännu" description="Skapa snabbt med preset, flera personal eller team. Avancerat pass finns kvar för specialfall." action={<Link href="/availability/presets" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Välj preset</Link>} />}
          </section>

          <aside className="space-y-5">
            <FormCard title="Snabbfrånvaro" description="Markera snabbt sjuk/frånvarande för en dag. Batch 8 använder detta för omplanering.">
              <form action={quickAbsenceAction} className="space-y-4">
                <Field label="Personal"><select name="staff_profile_id" required className={selectClassName}><option value="">Välj personal</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
                <Field label="Datum"><input name="absence_date" type="date" required className={inputClassName} /></Field>
                <Field label="Orsak"><input name="reason" defaultValue="Sjuk" className={inputClassName} /></Field>
                <button className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Sjuk/frånvarande denna dag</button>
              </form>
            </FormCard>

            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Presets i denna miljö</h2>
              <div className="mt-4 space-y-2">
                {visiblePresets.slice(0, 8).map((preset: any) => <Link key={preset.id} href={`/schedule?preset=${preset.id}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"><b>{preset.name}</b><span className="block text-xs text-slate-500">{timeLabel(preset.start_time)}–{timeLabel(preset.end_time)} · {preset.preset_scope === 'company' ? 'egen' : 'system'}</span></Link>)}
              </div>
              <Link href="/availability/presets" className="mt-4 inline-flex text-sm font-semibold text-slate-950">Hantera alla presets →</Link>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
