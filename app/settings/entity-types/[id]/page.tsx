export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  archiveEntityTypeAction,
  archiveEntityTypeFieldAction,
  createEntityTypeFieldAction,
  updateEntityTypeAction,
} from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function EntityTypeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: entityType }, { data: fields }, { count: activeEntities }] = await Promise.all([
    supabaseAdmin
      .from('entity_types')
      .select('id, code, label_singular, label_plural, description, source, is_active, sort_order')
      .eq('id', id)
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('entity_type_fields')
      .select('id, field_key, label, field_type, is_required, is_sensitive, sort_order, config')
      .eq('entity_type_id', id)
      .is('archived_at', null)
      .order('sort_order'),
    supabaseAdmin
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', auth.membership.companyId)
      .eq('entity_type_id', id)
      .is('archived_at', null),
  ])

  if (!entityType) notFound()

  return (
    <AppShell auth={auth} title={entityType.label_plural} subtitle="Dynamiska fält, labels och arkivering för objekttypen.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-5">
          <FormCard title="Redigera objekttyp">
            <form action={updateEntityTypeAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={entityType.id} />
              <Field label="Singular"><input name="label_singular" defaultValue={entityType.label_singular} required className={inputClassName} /></Field>
              <Field label="Plural"><input name="label_plural" defaultValue={entityType.label_plural} required className={inputClassName} /></Field>
              <Field label="Sortering"><input name="sort_order" type="number" defaultValue={entityType.sort_order} className={inputClassName} /></Field>
              <Field label="Aktiv"><select name="is_active" defaultValue={entityType.is_active ? 'true' : 'false'} className={selectClassName}><option value="true">Aktiv</option><option value="false">Inaktiv</option></select></Field>
              <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" defaultValue={entityType.description ?? ''} className={textareaClassName} /></Field></div>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara objekttyp</button></div>
            </form>
          </FormCard>

          <FormCard title="Lägg till dynamiskt fält" description="Fältet sparas i objektets custom_fields och kan användas olika per bransch.">
            <form action={createEntityTypeFieldAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="entity_type_id" value={entityType.id} />
              <Field label="Fältnyckel"><input name="field_key" required className={inputClassName} placeholder="apartment_number" /></Field>
              <Field label="Label"><input name="label" required className={inputClassName} placeholder="Lägenhetsnummer" /></Field>
              <Field label="Fälttyp"><select name="field_type" defaultValue="text" className={selectClassName}><option value="text">Text</option><option value="textarea">Lång text</option><option value="number">Nummer</option><option value="date">Datum</option><option value="boolean">Ja/nej</option></select></Field>
              <Field label="Sortering"><input name="sort_order" type="number" defaultValue="100" className={inputClassName} /></Field>
              <Field label="Obligatoriskt"><select name="is_required" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>
              <Field label="Känsligt"><select name="is_sensitive" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field>
              <Field label="Placeholder"><input name="placeholder" className={inputClassName} /></Field>
              <Field label="Hjälptext"><input name="help_text" className={inputClassName} /></Field>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Lägg till fält</button></div>
            </form>
          </FormCard>
        </div>

        <div className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={entityType.is_active ? 'active' : 'inactive'} /></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{activeEntities ?? 0} aktiva objekt använder denna objekttyp. Arkivering blockeras om typen används.</p>
            <form action={archiveEntityTypeAction} className="mt-4">
              <input type="hidden" name="id" value={entityType.id} />
              <button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera objekttyp</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Dynamiska fält</h2>
            <div className="mt-4 space-y-3">
              {fields?.length ? fields.map((field) => (
                <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{field.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{field.field_key} · {field.field_type}</p>
                      <p className="mt-1 text-xs text-slate-400">{field.is_required ? 'Obligatoriskt' : 'Frivilligt'} · {field.is_sensitive ? 'Känsligt' : 'Ej känsligt'}</p>
                    </div>
                    <form action={archiveEntityTypeFieldAction}>
                      <input type="hidden" name="id" value={field.id} />
                      <input type="hidden" name="entity_type_id" value={entityType.id} />
                      <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Arkivera</button>
                    </form>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga dynamiska fält ännu.</p>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
