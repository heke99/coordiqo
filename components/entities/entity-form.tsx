'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { DynamicFieldInputs } from '@/components/entities/dynamic-field-inputs'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'

type EntityType = { id: string; label_singular: string; label_plural?: string | null }
type Team = { id: string; name: string }
type DynamicField = {
  id: string
  entity_type_id: string
  field_key: string
  label: string
  field_type: string
  is_required: boolean
  is_sensitive: boolean
  config?: Record<string, unknown> | null
  placeholder?: string | null
  help_text?: string | null
}

type EntityFormProps = {
  action: (formData: FormData) => void | Promise<void>
  entityTypes: EntityType[]
  teams: Team[]
  fields: DynamicField[]
  submitLabel: string
  entity?: {
    id: string
    entity_type_id: string
    name: string
    external_id: string | null
    primary_team_id: string | null
    status: string
    priority: string
    summary: string | null
    instructions: string | null
    custom_fields?: Record<string, unknown> | null
  }
}

export function EntityForm({ action, entityTypes, teams, fields, submitLabel, entity }: EntityFormProps) {
  const [selectedTypeId, setSelectedTypeId] = useState(entity?.entity_type_id ?? entityTypes[0]?.id ?? '')
  const selectedFields = useMemo(() => fields.filter((field) => field.entity_type_id === selectedTypeId), [fields, selectedTypeId])

  function validateRequiredDynamicFields(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    for (const field of selectedFields) {
      if (!field.is_required) continue
      const input = form.elements.namedItem(`cf_${field.field_key}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      if (!input || !input.value.trim()) {
        input?.focus()
        event.preventDefault()
        return
      }
    }
  }

  return (
    <form action={action} onSubmit={validateRequiredDynamicFields} className="grid gap-4 sm:grid-cols-2">
      {entity ? <input type="hidden" name="id" value={entity.id} /> : null}
      <Field label="Objekttyp">
        <select
          name="entity_type_id"
          value={selectedTypeId}
          onChange={(event) => setSelectedTypeId(event.target.value)}
          required
          className={selectClassName}
        >
          <option value="">Välj objekttyp</option>
          {entityTypes.map((type) => <option key={type.id} value={type.id}>{type.label_singular}</option>)}
        </select>
      </Field>
      <Field label="Namn"><input name="name" required defaultValue={entity?.name ?? ''} className={inputClassName} placeholder="Exempelvis Fastighet A, Hyresgäst B eller Kund C" /></Field>
      <Field label="Externt ID"><input name="external_id" defaultValue={entity?.external_id ?? ''} className={inputClassName} placeholder="Kundnummer, lägenhets-ID, objektnummer" /></Field>
      <Field label="Team"><select name="primary_team_id" defaultValue={entity?.primary_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
      <Field label="Status"><select name="status" defaultValue={entity?.status ?? 'active'} className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
      <Field label="Prioritet"><select name="priority" defaultValue={entity?.priority ?? 'normal'} className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
      <div className="sm:col-span-2"><Field label="Sammanfattning"><textarea name="summary" defaultValue={entity?.summary ?? ''} className={textareaClassName} placeholder="Kort sammanfattning av objektet" /></Field></div>
      <div className="sm:col-span-2"><Field label="Instruktioner"><textarea name="instructions" defaultValue={entity?.instructions ?? ''} className={textareaClassName} placeholder="Portkod, nyckelinfo, särskilda instruktioner eller arbetsregler" /></Field></div>

      <div className="sm:col-span-2 border-t border-slate-200 pt-2">
        <h3 className="text-sm font-semibold text-slate-950">Dynamiska fält</h3>
        <p className="mt-1 text-xs text-slate-500">Fält hämtas från vald objekttyp.</p>
      </div>
      <DynamicFieldInputs fields={selectedFields} values={entity?.custom_fields ?? {}} />

      {!entity ? (
        <>
          <div className="sm:col-span-2 border-t border-slate-200 pt-2"><h3 className="text-sm font-semibold text-slate-950">Adress och kontakt</h3></div>
          <Field label="Gatuadress"><input name="street" className={inputClassName} /></Field>
          <Field label="Postnummer"><input name="postal_code" className={inputClassName} /></Field>
          <Field label="Ort"><input name="city" className={inputClassName} /></Field>
          <Field label="Accessinstruktion"><input name="access_instructions" className={inputClassName} /></Field>
          <Field label="Kontaktperson"><input name="contact_name" className={inputClassName} /></Field>
          <Field label="Kontaktroll"><input name="contact_role" className={inputClassName} placeholder="Hyresgäst, kund, anhörig, kontaktperson" /></Field>
          <Field label="Kontakt e-post"><input name="contact_email" type="email" className={inputClassName} /></Field>
          <Field label="Kontakt telefon"><input name="contact_phone" className={inputClassName} /></Field>
        </>
      ) : null}

      <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{submitLabel}</button></div>
    </form>
  )
}
