export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { BulkShiftCreateForm } from '@/components/schedule/bulk-shift-create-form'
import { Field, FormCard, inputClassName, selectClassName } from '@/components/ui/form-card'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { bulkUpdateShiftsAction, copyWeekAction, quickAbsenceAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type StaffOption = {
  id: string
  full_name: string | null
  job_title: string | null
  primary_team_id?: string | null
  status?: string | null
}

type TeamOption = {
  id: string
  name: string | null
}

type ShiftPresetOption = {
  id: string
  name: string | null
  preset_scope: string | null
  industry_type?: string | null
  start_time: string | null
  end_time: string | null
  default_status: string | null
  break_minutes: number | null
  buffer_minutes: number | null
  transport_mode: string | null
  start_location_type: string | null
  end_location_type: string | null
}

type BulkRunItem = {
  id: string
  shift_date: string | null
  status: string | null
  conflict_summary: string | null
  skipped_reason: string | null
}

type ShiftListItem = {
  id: string
  title: string | null
  shift_date: string | null
  starts_at: string
  ends_at: string
  status: string | null
  capacity_minutes: number | null
  planned_minutes: number | null
  remaining_minutes: number | null
  planning_locked: boolean | null
  staff_profiles?: { full_name: string | null } | { full_name: string | null }[] | null
  teams?: { name: string | null } | { name: string | null }[] | null
}

function staffRelationName(relation: ShiftListItem['staff_profiles']) {
  if (Array.isArray(relation)) return relation[0]?.full_name ?? null
  return relation?.full_name ?? null
}

function teamRelationName(relation: ShiftListItem['teams']) {
  if (Array.isArray(relation)) return relation[0]?.name ?? null
  return relation?.name ?? null
}

function timeLabel(value: string | null) {
  return value ? String(value).slice(0, 5) : ''
}

function shiftTimeLabel(startsAt: string, endsAt: string) {
  return `${new Date(startsAt).toLocaleString('sv-SE')}–${new Date(endsAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function defaultMonday() {
  const now = new Date()
  const day = now.getDay() || 7
  now.setDate(now.getDate() - day + 1)
  return now.toISOString().slice(0, 10)
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; status?: string; preset?: string; bulk_run?: string }> }) {
  const auth = await requireCompanyContext()
  const params = await searchParams
  const q = params.q?.trim()
  const date = params.date?.trim()
  const status = params.status?.trim()
  const selectedPresetId = params.preset?.trim()

  const [{ data: staff }, { data: teams }, { data: presets }, { data: bulkRun }, { data: bulkItems }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name, job_title, primary_team_id, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('shift_presets').select('*').is('archived_at', null).eq('is_active', true).or(`company_id.eq.${auth.membership.companyId},preset_scope.eq.system`).order('preset_scope').order('is_favorite', { ascending: false }).order('name'),
    params.bulk_run ? supabaseAdmin.from('shift_bulk_runs').select('*').eq('id', params.bulk_run).eq('company_id', auth.membership.companyId).maybeSingle() : Promise.resolve({ data: null }),
    params.bulk_run ? supabaseAdmin.from('shift_bulk_run_items').select('id, shift_id, staff_profile_id, team_id, shift_date, status, conflict_summary, skipped_reason').eq('bulk_run_id', params.bulk_run).eq('company_id', auth.membership.companyId).limit(80) : Promise.resolve({ data: [] }),
  ])

  const staffOptions = (staff ?? []) as StaffOption[]
  const teamOptions = (teams ?? []) as TeamOption[]
  const presetOptions = (presets ?? []) as ShiftPresetOption[]
  const visiblePresets = presetOptions.filter((preset) => preset.preset_scope === 'company' || !preset.industry_type || preset.industry_type === auth.membership?.industryType)
  const bulkRunItems = (bulkItems ?? []) as BulkRunItem[]

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
  const shiftRows = (shifts ?? []) as ShiftListItem[]
  const monday = defaultMonday()

  return (
    <AppShell auth={auth} title="Schema" subtitle="Snabbt schemaflöde med preview, bulk, kopiera pass, kopiera vecka och massändring." actions={<Link href="/schedule/new" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Avancerat pass</Link>}>
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
            {bulkRunItems.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bulkRunItems.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white/80 p-3 text-xs text-emerald-900">
                    <b>{item.shift_date}</b> · {item.status}
                    {item.conflict_summary ? <span className="block text-amber-700">{item.conflict_summary}</span> : null}
                    {item.skipped_reason ? <span className="block text-red-700">{item.skipped_reason}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <FormCard title="Snabbt schema / bulk skapa pass" description="Förhandsgranska först, kontrollera konflikter och skapa sedan pass för flera personer eller team.">
          <BulkShiftCreateForm staff={staffOptions} teams={teamOptions} visiblePresets={visiblePresets} selectedPresetId={selectedPresetId} />
        </FormCard>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
          <section className="space-y-5">
            <SearchFilter action="/schedule" defaultValue={q} placeholder="Sök pass" newHref="/schedule/new" newLabel="Avancerat pass">
              <input name="date" type="date" defaultValue={date ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
              <select name="status" defaultValue={status ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
                <option value="">Alla statusar</option>
                <option value="draft">Utkast</option>
                <option value="planned">Planerat</option>
                <option value="confirmed">Bekräftat</option>
                <option value="cancelled">Avbokat</option>
              </select>
            </SearchFilter>

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div> : null}

            {shiftRows.length ? (
              <form action={bulkUpdateShiftsAction} className="space-y-3">
                <div className="coordiqo-card p-4">
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <select name="status" className={selectClassName}><option value="">Behåll status</option><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option><option value="cancelled">Avbokat</option></select>
                    <select name="staff_profile_id" className={selectClassName}><option value="">Behåll personal</option><option value="__clear__">Ta bort personal</option>{staffOptions.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
                    <select name="team_id" className={selectClassName}><option value="">Behåll team</option><option value="__clear__">Ta bort team</option>{teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
                    <input name="move_date_to" type="date" className={inputClassName} />
                    <input name="start_time" type="time" className={inputClassName} />
                    <input name="end_time" type="time" className={inputClassName} />
                    <select name="transport_mode" className={selectClassName}><option value="">Behåll färdsätt</option><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option></select>
                    <input name="break_minutes" type="number" min="0" placeholder="Rast min" className={inputClassName} />
                    <input name="buffer_minutes" type="number" min="0" placeholder="Buffer min" className={inputClassName} />
                    <select name="planning_locked" className={selectClassName}><option value="">Behåll låsning</option><option value="true">Lås</option><option value="false">Lås upp</option></select>
                    <select name="archive" className={selectClassName}><option value="false">Arkivera inte</option><option value="true">Arkivera valda</option></select>
                    <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Massändra valda</button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {shiftRows.map((shift) => (
                    <div key={shift.id} className="coordiqo-card p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <label className="flex gap-3">
                          <input type="checkbox" name="shift_ids" value={shift.id} className="mt-1" />
                          <span>
                            <Link href={`/schedule/${shift.id}`} className="text-base font-semibold text-slate-950 hover:underline">{shift.title ?? 'Pass'}</Link>
                            <span className="mt-1 block text-sm text-slate-500">{staffRelationName(shift.staff_profiles) ?? teamRelationName(shift.teams) ?? 'Ej kopplat'} · {shiftTimeLabel(shift.starts_at, shift.ends_at)}</span>
                            <span className="mt-1 block text-xs text-slate-400">Kapacitet {shift.capacity_minutes ?? 0} min · Planerat {shift.planned_minutes ?? 0} min · Kvar {shift.remaining_minutes ?? 0} min{shift.planning_locked ? ' · låst' : ''}</span>
                          </span>
                        </label>
                        <StatusBadge status={shift.status} />
                      </div>
                      <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">Öppna passet för att kopiera det till annan dag eller annan personal.</p>

                    </div>
                  ))}
                </div>
              </form>
            ) : (
              <EmptyState eyebrow="Schema" title="Inga pass ännu" description="Skapa snabbt med mall, flera personal eller team. Avancerat pass finns kvar för specialfall." action={<Link href="/availability/presets" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Välj mall</Link>} />
            )}
          </section>

          <aside className="space-y-5">
            <FormCard title="Kopiera vecka" description="Kopiera en persons eller ett teams vecka till en ny vecka. Systemet kontrollerar konflikter under kopieringen.">
              <form action={copyWeekAction} className="space-y-4">
                <Field label="Källvecka, måndag"><input name="source_week_start" type="date" defaultValue={monday} required className={inputClassName} /></Field>
                <Field label="Målvecka, måndag"><input name="target_week_start" type="date" required className={inputClassName} /></Field>
                <Field label="Personal, valfritt"><select name="staff_profile_id" className={selectClassName}><option value="">Alla/behåll</option>{staffOptions.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
                <Field label="Team, valfritt"><select name="team_id" className={selectClassName}><option value="">Alla/behåll</option>{teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
                <Field label="Konflikter"><select name="conflict_mode" defaultValue="skip_blocking" className={selectClassName}><option value="skip_blocking">Hoppa över konfliktpass</option><option value="create_all">Kopiera alla med varning</option></select></Field>
                <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Kopiera vecka</button>
              </form>
            </FormCard>

            <FormCard title="Snabbfrånvaro" description="Markera snabbt sjuk/frånvarande för en dag. Planeringsmotorn använder detta för omplanering.">
              <form action={quickAbsenceAction} className="space-y-4">
                <Field label="Personal"><select name="staff_profile_id" required className={selectClassName}><option value="">Välj personal</option>{staffOptions.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
                <Field label="Datum"><input name="absence_date" type="date" required className={inputClassName} /></Field>
                <Field label="Orsak"><input name="reason" defaultValue="Sjuk" className={inputClassName} /></Field>
                <button className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Sjuk/frånvarande denna dag</button>
              </form>
            </FormCard>

            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Presets i denna miljö</h2>
              <div className="mt-4 space-y-2">
                {visiblePresets.slice(0, 8).map((preset) => (
                  <Link key={preset.id} href={`/schedule?preset=${preset.id}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <b>{preset.name}</b>
                    <span className="block text-xs text-slate-500">{timeLabel(preset.start_time)}–{timeLabel(preset.end_time)} · {preset.preset_scope === 'company' ? 'egen' : 'system'}</span>
                  </Link>
                ))}
              </div>
              <Link href="/availability/presets" className="mt-4 inline-flex text-sm font-semibold text-slate-950">Hantera alla presets →</Link>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
