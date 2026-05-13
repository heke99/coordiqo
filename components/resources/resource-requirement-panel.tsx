import { archiveResourceRequirementAction, createResourceRequirementAction } from '@/lib/platform/actions'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'

export type ResourceRequirementPanelProps = {
  ownerType: 'entity' | 'task' | 'project' | 'project_work_item'
  ownerId: string
  returnPath: string
  title?: string
  description?: string
  resourceTypes: Array<{ id: string; name: string | null }>
  resources: Array<{ id: string; name: string | null; status?: string | null }>
  requirements: Array<{
    id: string
    requirement_label?: string | null
    quantity?: number | null
    is_hard_requirement?: boolean | null
    description?: string | null
    resource_assets?: { name?: string | null } | Array<{ name?: string | null }> | null
    resource_types?: { name?: string | null } | Array<{ name?: string | null }> | null
  }>
}

function relationName(value: { name?: string | null } | Array<{ name?: string | null }> | null | undefined) {
  if (Array.isArray(value)) return value[0]?.name ?? null
  return value?.name ?? null
}

export function ResourceRequirementPanel({ ownerType, ownerId, returnPath, title = 'Resurser som behövs', description, resourceTypes, resources, requirements }: ResourceRequirementPanelProps) {
  return (
    <section className="coordiqo-card p-5 sm:p-7">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {description ?? 'Lägg till branschneutrala resurskrav. Välj exakt resurs, till exempel Nyckel 15, eller valfri resurs av en typ, till exempel Bil.'}
        </p>
      </div>

      <form action={createResourceRequirementAction} className="grid gap-4">
        <input type="hidden" name="owner_type" value={ownerType} />
        <input type="hidden" name="owner_id" value={ownerId} />
        <input type="hidden" name="return_path" value={returnPath} />
        <Field label="Kravtyp">
          <select name="requirement_mode" defaultValue="exact" className={selectClassName}>
            <option value="exact">Exakt resurs</option>
            <option value="type">Valfri resurs av typ</option>
            <option value="custom">Eget krav/namn</option>
          </select>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Exakt resurs">
            <select name="resource_asset_id" className={selectClassName}>
              <option value="">Ingen exakt resurs</option>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.status ?? 'status saknas'}</option>)}
            </select>
          </Field>
          <Field label="Resurstyp">
            <select name="resource_type_id" className={selectClassName}>
              <option value="">Ingen typ</option>
              {resourceTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Namn/label"><input name="requirement_label" className={inputClassName} placeholder="Ex. nyckel, bil, borrmaskin" /></Field>
          <Field label="Antal"><input name="quantity" type="number" min="1" defaultValue="1" className={inputClassName} /></Field>
          <Field label="Kravnivå"><select name="is_hard_requirement" defaultValue="true" className={selectClassName}><option value="true">Hårt krav</option><option value="false">Mjuk varning</option></select></Field>
        </div>
        <Field label="Beskrivning"><textarea name="description" className={textareaClassName} placeholder="Ex. behövs för tillträde, transport eller särskilt arbetsmoment" /></Field>
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till resurskrav</button>
      </form>

      <div className="mt-5 space-y-3">
        {requirements.length ? requirements.map((requirement) => (
          <div key={requirement.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{relationName(requirement.resource_assets) ?? relationName(requirement.resource_types) ?? requirement.requirement_label ?? 'Resurskrav'}</p>
                <p className="mt-1 text-sm text-slate-500">{requirement.quantity ?? 1} st · {requirement.is_hard_requirement ? 'hårt krav' : 'mjuk varning'}</p>
                {requirement.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{requirement.description}</p> : null}
              </div>
              <form action={archiveResourceRequirementAction}>
                <input type="hidden" name="id" value={requirement.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Ta bort</button>
              </form>
            </div>
          </div>
        )) : <p className="text-sm text-slate-600">Inga resurskrav ännu.</p>}
      </div>
    </section>
  )
}
