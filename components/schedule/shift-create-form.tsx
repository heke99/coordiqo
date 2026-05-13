'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createShiftFormAction } from '@/lib/platform/actions'

type StaffOption = {
  id: string
  full_name: string | null
}

type TeamOption = {
  id: string
  name: string | null
}

type ShiftFormValues = Record<string, string | string[]>

type ShiftFormState = {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string>
  values?: ShiftFormValues
}

const initialState: ShiftFormState = {
  ok: undefined,
  message: undefined,
  fieldErrors: {},
  values: {},
}

function stringValue(values: ShiftFormValues | undefined, key: string, fallback = '') {
  const value = values?.[key]
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function fieldMessage(state: ShiftFormState, key: string) {
  const message = state.fieldErrors?.[key]
  if (!message) return null
  return <p className="mt-1.5 text-xs font-semibold text-red-700">{message}</p>
}

function fieldClass(state: ShiftFormState, key: string, baseClassName: string) {
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

export function ShiftCreateForm({ staff, teams }: { staff: StaffOption[]; teams: TeamOption[] }) {
  const [state, formAction] = useActionState(createShiftFormAction, initialState)
  const values = state.values

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      {state.ok === false ? (
        <div role="alert" className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Kontrollera formuläret</p>
          <p className="mt-1">{state.message ?? 'Något behöver rättas innan pass kan skapas.'}</p>
        </div>
      ) : null}

      <Field label="Titel">
        <input name="title" defaultValue={stringValue(values, 'title')} className={inputClassName} placeholder="Dagpass, morgonteam, jour..." />
      </Field>

      <Field label="Datum">
        <input name="shift_date" type="date" defaultValue={stringValue(values, 'shift_date')} className={fieldClass(state, 'shift_date', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.shift_date)} />
        {fieldMessage(state, 'shift_date')}
      </Field>

      <Field label="Starttid">
        <input name="start_time" type="time" defaultValue={stringValue(values, 'start_time')} className={fieldClass(state, 'start_time', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.start_time)} />
        {fieldMessage(state, 'start_time')}
      </Field>

      <Field label="Sluttid" hint="Om sluttiden är tidigare än starttiden räknas passet som nattpass som slutar nästa dag.">
        <input name="end_time" type="time" defaultValue={stringValue(values, 'end_time')} className={fieldClass(state, 'end_time', inputClassName)} aria-invalid={Boolean(state.fieldErrors?.end_time)} />
        {fieldMessage(state, 'end_time')}
      </Field>

      <Field label="Personal">
        <select name="staff_profile_id" defaultValue={stringValue(values, 'staff_profile_id')} className={selectClassName}>
          <option value="">Ingen personal</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </Field>

      <Field label="Team">
        <select name="team_id" defaultValue={stringValue(values, 'team_id')} className={selectClassName}>
          <option value="">Inget team</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </Field>

      <Field label="Rast minuter">
        <input name="break_minutes" type="number" min="0" defaultValue={stringValue(values, 'break_minutes', '30')} className={inputClassName} />
      </Field>

      <Field label="Buffer minuter">
        <input name="buffer_minutes" type="number" min="0" defaultValue={stringValue(values, 'buffer_minutes', '15')} className={inputClassName} />
      </Field>

      <Field label="Planerat minuter">
        <input name="planned_minutes" type="number" min="0" defaultValue={stringValue(values, 'planned_minutes', '0')} className={inputClassName} />
      </Field>

      <Field label="Färdsätt">
        <select name="transport_mode" defaultValue={stringValue(values, 'transport_mode', 'car')} className={selectClassName}>
          <option value="car">Bil</option>
          <option value="service_vehicle">Servicebil</option>
          <option value="electric_vehicle">Elbil</option>
          <option value="bike">Cykel</option>
          <option value="walk">Gång</option>
          <option value="public_transport">Kollektivtrafik</option>
          <option value="mixed">Mixat</option>
        </select>
      </Field>

      <Field label="Startplats">
        <select name="start_location_type" defaultValue={stringValue(values, 'start_location_type', 'company_base')} className={selectClassName}>
          <option value="home">Hem</option>
          <option value="company_base">Kontor/företagsbas</option>
          <option value="team_base">Team-bas</option>
          <option value="custom">Egen adress</option>
          <option value="first_task">Första uppdraget</option>
        </select>
      </Field>

      <Field label="Startadress">
        <input name="start_address_text" defaultValue={stringValue(values, 'start_address_text')} className={inputClassName} />
      </Field>

      <Field label="Slutplats">
        <select name="end_location_type" defaultValue={stringValue(values, 'end_location_type', 'company_base')} className={selectClassName}>
          <option value="home">Hem</option>
          <option value="company_base">Kontor/företagsbas</option>
          <option value="team_base">Team-bas</option>
          <option value="custom">Egen adress</option>
          <option value="last_task">Sista uppdraget</option>
        </select>
      </Field>

      <Field label="Slutadress">
        <input name="end_address_text" defaultValue={stringValue(values, 'end_address_text')} className={inputClassName} />
      </Field>

      <Field label="Status">
        <select name="status" defaultValue={stringValue(values, 'status', 'planned')} className={selectClassName}>
          <option value="draft">Utkast</option>
          <option value="planned">Planerat</option>
          <option value="confirmed">Bekräftat</option>
        </select>
      </Field>

      <Field label="Lås pass för AI/mallar">
        <select name="planning_locked" defaultValue={stringValue(values, 'planning_locked', 'false')} className={selectClassName}>
          <option value="false">Nej</option>
          <option value="true">Ja</option>
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field label="Låsningsorsak">
          <input name="locked_reason" defaultValue={stringValue(values, 'locked_reason')} className={inputClassName} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Anteckningar">
          <textarea name="notes" defaultValue={stringValue(values, 'notes')} className={textareaClassName} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  )
}
