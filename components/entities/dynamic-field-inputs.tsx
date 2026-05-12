import { inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'

type DynamicField = {
  id: string
  field_key: string
  label: string
  field_type: string
  is_required: boolean
  is_sensitive: boolean
  config?: Record<string, unknown> | null
  placeholder?: string | null
  help_text?: string | null
}

type DynamicFieldInputsProps = {
  fields: DynamicField[] | null | undefined
  values?: Record<string, unknown> | null
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function getPlaceholder(field: DynamicField) {
  const fromConfig = typeof field.config?.placeholder === 'string' ? field.config.placeholder : null
  return field.placeholder ?? fromConfig ?? ''
}

function getHelpText(field: DynamicField) {
  const fromConfig = typeof field.config?.help_text === 'string' ? field.config.help_text : null
  return field.help_text ?? fromConfig
}

export function DynamicFieldInputs({ fields, values }: DynamicFieldInputsProps) {
  if (!fields?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:col-span-2">
        Inga dynamiska fält finns för denna objekttyp ännu. Lägg till fält under Inställningar → Objekttyper.
      </div>
    )
  }

  return (
    <>
      {fields.map((field) => {
        const name = `cf_${field.field_key}`
        const defaultValue = stringValue(values?.[field.field_key])
        const placeholder = getPlaceholder(field)
        const helpText = getHelpText(field)

        return (
          <div key={field.id} className={field.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="block text-sm font-semibold text-slate-800">
              {field.label}
              {field.is_required ? <span className="text-red-500"> *</span> : null}
              {field.is_sensitive ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">känsligt</span> : null}
            </label>
            {field.field_type === 'textarea' ? (
              <textarea name={name} defaultValue={defaultValue} required={field.is_required} placeholder={placeholder} className={`${textareaClassName} mt-2`} />
            ) : field.field_type === 'boolean' ? (
              <select name={name} defaultValue={defaultValue} required={field.is_required} className={`${selectClassName} mt-2`}>
                <option value="">Välj</option>
                <option value="true">Ja</option>
                <option value="false">Nej</option>
              </select>
            ) : (
              <input
                name={name}
                type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                defaultValue={defaultValue}
                required={field.is_required}
                placeholder={placeholder}
                className={`${inputClassName} mt-2`}
              />
            )}
            {helpText ? <p className="mt-2 text-xs leading-5 text-slate-500">{helpText}</p> : null}
          </div>
        )
      })}
    </>
  )
}
