'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { bulkCreateShiftsFormAction } from '@/lib/platform/actions'

type StaffOption = {
  id: string
  full_name: string | null
  job_title: string | null
}

type TeamOption = {
  id: string
  name: string | null
}

type ShiftPresetOption = {
  id: string
  name: string | null
  preset_scope: string | null
  start_time: string | null
  end_time: string | null
  default_status: string | null
  break_minutes: number | null
  buffer_minutes: number | null
  transport_mode: string | null
  start_location_type: string | null
  end_location_type: string | null
}

type BulkShiftFormValues = Record<string, string | string[]>

type BulkShiftFormState = {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string>
  values?: BulkShiftFormValues
}

const initialState: BulkShiftFormState = {
  ok: undefined,
  message: undefined,
  fieldErrors: {},
  values: {},
}

function timeLabel(value: string | null | undefined) {
  return value ? String(value).slice(0, 5) : ''
}

function stringValue(values: BulkShiftFormValues | undefined, key: string, fallback = '') {
  const value = values?.[key]
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function stringValues(values: BulkShiftFormValues | undefined, key: string, fallback: string[] = []) {
  const value = values?.[key]
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value !== '') return [value]
  return fallback
}

function fieldMessage(state: BulkShiftFormState, key: string) {
  const message = state.fieldErrors?.[key]
  if (!message) return null
  return <p className="mt-1.5 text-xs font-semibold text-red-700">{message}</p>
}

function fieldClass(state: BulkShiftFormState, key: string, baseClassName: string) {
  return state.fieldErrors?.[key] ? `${baseClassName} border-red-300 bg-red-50 ring-2 ring-red-100` : baseClassName
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? 'Skapar pass…' : 'Skapa pass'}
    </button>
  )
}

export function BulkShiftCreateForm({
  staff,
  teams,
  visiblePresets,
  selectedPresetId,
}: {
  staff: StaffOption[]
  teams: TeamOption[]
  visiblePresets: ShiftPresetOption[]
  selectedPresetId?: string | null
}) {
  const [state, formAction] = useActionState(bulkCreateShiftsFormAction, initialState)
  const selectedPreset = visiblePresets.find((preset) => preset.id === selectedPresetId)
  const values = state.values
  const selectedWeekdays = stringValues(values, 'weekdays')
  const selectedStaffIds = stringValues(values, 'staff_profile_ids')
  const selectedTeamIds = stringValues(values, 'team_ids')
  const targetError = state.fieldErrors?.targets

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3" noValidate>
      {state.ok === false ? (
        <div role="alert" className="lg:col-span-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Kontrollera formuläret</p>
          <p className="mt-1">{state.message ?? 'Något behöver rättas innan pass kan skapas.'}</p>
          {targetError ? <p className="mt-1 text-xs font-semibold">{targetError}</p> : null}
        </div>
      ) : null}

      <Field label="Preset">
        <select name="preset_id" defaultValue={stringValue(values, 'preset_id', selectedPresetId ?? 'custom')} className={selectClassName}>
          <option value="custom">Annat / eget pass</option>
          {visiblePresets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.preset_scope === 'company' ? 'Egen' : 'System'} · {preset.name} · {timeLabel(preset.start_time)}-{timeLabel(preset.end_time)}</option>
          ))}
        </select>
      </Field>

      <Field label="Eget namn">
        <input name="custom_name" defaultValue={stringValue(values, 'custom_name', selectedPreset ? selectedPreset.name ?? '' : '')} className={inputClassName} placeholder="Ex. Team Syd morgon" />
      </Field>

      <Field label="Spara eget som preset">
        <select name="save_custom_as_preset" defaultValue={stringValue(values, 'save_custom_as_preset', 'false')} className={selectClassName}>
          <option value="false">Nej</option>
          <option value="true">Ja</option>
        </select>
      </Field>

      <Field label="Starttid">
        <input name="start_time" type="time" defaultValue={stringValue(values, 'start_time', timeLabel(selectedPreset?.start_time))} className={fieldClass(state, 'start_time', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.start_time)} />
        {fieldMessage(state, 'start_time')}
      </Field>

      <Field label="Sluttid">
        <input name="end_time" type="time" defaultValue={stringValue(values, 'end_time', timeLabel(selectedPreset?.end_time))} className={fieldClass(state, 'end_time', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.end_time)} />
        {fieldMessage(state, 'end_time')}
      </Field>

      <Field label="Status">
        <select name="status" defaultValue={stringValue(values, 'status', selectedPreset?.default_status ?? 'draft')} className={selectClassName}>
          <option value="draft">Utkast</option>
          <option value="planned">Planerat</option>
          <option value="confirmed">Bekräftat</option>
        </select>
      </Field>

      <Field label="Från datum">
        <input name="date_from" type="date" defaultValue={stringValue(values, 'date_from')} className={fieldClass(state, 'date_from', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.date_from)} />
        {fieldMessage(state, 'date_from')}
      </Field>

      <Field label="Till datum">
        <input name="date_to" type="date" defaultValue={stringValue(values, 'date_to')} className={fieldClass(state, 'date_to', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.date_to)} />
        {fieldMessage(state, 'date_to')}
      </Field>

      <Field label="Konflikter">
        <select name="conflict_mode" defaultValue={stringValue(values, 'conflict_mode', 'skip_blocking')} className={selectClassName}>
          <option value="skip_blocking">Hoppa över konfliktpass</option>
          <option value="create_all">Skapa alla med varning</option>
        </select>
      </Field>

      <Field label="Rast minuter">
        <input name="break_minutes" type="number" min="0" defaultValue={stringValue(values, 'break_minutes', String(selectedPreset?.break_minutes ?? 30))} className={inputClassName} />
      </Field>

      <Field label="Buffer minuter">
        <input name="buffer_minutes" type="number" min="0" defaultValue={stringValue(values, 'buffer_minutes', String(selectedPreset?.buffer_minutes ?? 15))} className={inputClassName} />
      </Field>

      <Field label="Färdsätt">
        <select name="transport_mode" defaultValue={stringValue(values, 'transport_mode', selectedPreset?.transport_mode ?? 'car')} className={selectClassName}>
          <option value="car">Bil</option>
          <option value="service_vehicle">Servicebil</option>
          <option value="electric_vehicle">Elbil</option>
          <option value="bike">Cykel</option>
          <option value="walk">Gång</option>
          <option value="public_transport">Kollektivtrafik</option>
          <option value="mixed">Mixat</option>
        </select>
      </Field>

      <div className="lg:col-span-3 grid gap-4 lg:grid-cols-2">
        <Field label="Personal, flera val" hint="Håll cmd/ctrl för att välja flera. Systemet skapar ett pass per vald person och dag.">
          <select name="staff_profile_ids" multiple defaultValue={selectedStaffIds} size={Math.min(8, Math.max(4, staff.length || 4))} className={fieldClass(state, 'staff_profile_ids', selectClassName)} aria-invalid={Boolean(state.fieldErrors?.staff_profile_ids)}>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}{person.job_title ? ` · ${person.job_title}` : ''}</option>)}
          </select>
          {fieldMessage(state, 'staff_profile_ids')}
        </Field>

        <Field label="Team, flera val" hint="Välj team och slå på auto-fyll för att skapa pass för teammedlemmar.">
          <select name="team_ids" multiple defaultValue={selectedTeamIds} size={Math.min(8, Math.max(4, teams.length || 4))} className={fieldClass(state, 'team_ids', selectClassName)} aria-invalid={Boolean(state.fieldErrors?.team_ids)}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          {fieldMessage(state, 'team_ids')}
        </Field>
      </div>

      <Field label="Auto-fyll teammedlemmar">
        <select name="include_team_members" defaultValue={stringValue(values, 'include_team_members', 'true')} className={selectClassName}>
          <option value="true">Ja, välj teamets personal</option>
          <option value="false">Nej, skapa teampass eller använd bara valda personal</option>
        </select>
      </Field>

      <Field label="Startplats">
        <select name="start_location_type" defaultValue={stringValue(values, 'start_location_type', selectedPreset?.start_location_type ?? 'company_base')} className={selectClassName}>
          <option value="home">Hem</option>
          <option value="company_base">Kontor/företagsbas</option>
          <option value="team_base">Team-bas</option>
          <option value="custom">Egen adress</option>
          <option value="first_task">Första uppdraget</option>
        </select>
      </Field>

      <Field label="Slutplats">
        <select name="end_location_type" defaultValue={stringValue(values, 'end_location_type', selectedPreset?.end_location_type ?? 'company_base')} className={selectClassName}>
          <option value="home">Hem</option>
          <option value="company_base">Kontor/företagsbas</option>
          <option value="team_base">Team-bas</option>
          <option value="custom">Egen adress</option>
          <option value="last_task">Sista uppdraget</option>
        </select>
      </Field>

      <div className="lg:col-span-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Veckodagar</p>
        <div className="flex flex-wrap gap-2">
          {[[1, 'Mån'], [2, 'Tis'], [3, 'Ons'], [4, 'Tor'], [5, 'Fre'], [6, 'Lör'], [7, 'Sön']].map(([value, label]) => {
            const checked = selectedWeekdays.length ? selectedWeekdays.includes(String(value)) : Number(value) <= 5
            return (
              <label key={value} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" name="weekdays" value={value} defaultChecked={checked} className="mr-2" />{label}
              </label>
            )
          })}
        </div>
      </div>

      <div className="lg:col-span-3">
        <Field label="Notering">
          <textarea name="notes" defaultValue={stringValue(values, 'notes')} className={textareaClassName} placeholder="Syns på skapade pass." />
        </Field>
      </div>

      <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
        <SubmitButton />
        <Link href="/availability/presets" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">Hantera presets</Link>
      </div>
    </form>
  )
}
