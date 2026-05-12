export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { EntityForm } from '@/components/entities/entity-form'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  archiveEntityAction,
  createEntityDocumentAction,
  createEntityNoteAction,
  createEntityRelationAction,
  updateEntityAction,
} from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params
  const [
    { data: entity },
    { data: entityTypes },
    { data: teams },
    { data: addresses },
    { data: contacts },
    { data: fields },
    { data: notes },
    { data: documents },
    { data: relations },
    { data: relationTargets },
  ] = await Promise.all([
    supabaseAdmin.from('entities').select('*, entity_types(label_singular, label_plural)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('entity_types').select('id, label_singular, label_plural').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('entity_addresses').select('*').eq('entity_id', id).order('is_primary', { ascending: false }),
    supabaseAdmin.from('entity_contacts').select('*').eq('entity_id', id).order('is_primary', { ascending: false }),
    supabaseAdmin.from('entity_type_fields').select('id, entity_type_id, field_key, label, field_type, is_required, is_sensitive, config, placeholder, help_text').is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('entity_notes').select('id, note, visibility, created_at').eq('entity_id', id).eq('company_id', auth.membership.companyId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('entity_documents').select('id, file_name, storage_path, document_type, status, created_at').eq('entity_id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('entity_relations').select('id, relation_type, child_entity_id, entities!entity_relations_child_entity_id_fkey(name)').eq('company_id', auth.membership.companyId).eq('parent_entity_id', id).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('entities').select('id, name').eq('company_id', auth.membership.companyId).neq('id', id).is('archived_at', null).order('name').limit(100),
  ])
  if (!entity) notFound()

  return (
    <AppShell auth={auth} title={entity.name} subtitle={`${entity.entity_types?.label_singular ?? 'Objekt'} · status, relationer och kärnuppgifter.`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-5">
          <FormCard title="Redigera objekt">
            <EntityForm
              action={updateEntityAction}
              entity={entity}
              entityTypes={entityTypes ?? []}
              teams={teams ?? []}
              fields={fields ?? []}
              submitLabel="Spara ändringar"
            />
          </FormCard>

          <FormCard title="Ny notering" description="Intern notering kopplad till objektet. Senare kan detta användas i personalvy och portal.">
            <form action={createEntityNoteAction} className="grid gap-4">
              <input type="hidden" name="entity_id" value={entity.id} />
              <Field label="Synlighet"><select name="visibility" defaultValue="internal" className={selectClassName}><option value="internal">Intern</option><option value="staff">Personal</option><option value="external">Extern/portal senare</option></select></Field>
              <Field label="Notering"><textarea name="note" required className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Lägg till notering</button>
            </form>
          </FormCard>
        </div>

        <div className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={entity.status} /></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete så historik, relationer och kommande uppdrag inte tappas.</p>
            <form action={archiveEntityAction} className="mt-4"><input type="hidden" name="id" value={entity.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera objekt</button></form>
          </section>

          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Adresser</h2><div className="mt-4 space-y-3">{addresses?.length ? addresses.map((address) => <div key={address.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{address.label}</p><p className="mt-1 text-sm text-slate-500">{[address.street, address.postal_code, address.city].filter(Boolean).join(', ')}</p></div>) : <p className="text-sm text-slate-600">Ingen adress registrerad.</p>}</div></section>
          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Kontakter</h2><div className="mt-4 space-y-3">{contacts?.length ? contacts.map((contact) => <div key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{contact.name}</p><p className="mt-1 text-sm text-slate-500">{contact.role_label ?? 'Kontakt'} · {contact.phone ?? contact.email ?? 'saknar kontaktväg'}</p></div>) : <p className="text-sm text-slate-600">Ingen kontakt registrerad.</p>}</div></section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Relationer</h2>
            <form action={createEntityRelationAction} className="mt-4 grid gap-3">
              <input type="hidden" name="parent_entity_id" value={entity.id} />
              <Field label="Kopplat objekt"><select name="child_entity_id" required className={selectClassName}><option value="">Välj objekt</option>{relationTargets?.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></Field>
              <Field label="Relation"><select name="relation_type" defaultValue="related" className={selectClassName}><option value="related">Relaterad</option><option value="contains">Innehåller</option><option value="belongs_to">Tillhör</option><option value="contact_for">Kontakt för</option></select></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till relation</button>
            </form>
            <div className="mt-4 space-y-3">{relations?.length ? relations.map((relation: any) => <div key={relation.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{relation.entities?.name ?? relation.child_entity_id}</p><p className="mt-1 text-sm text-slate-500">{relation.relation_type}</p></div>) : <p className="text-sm text-slate-600">Inga relationer registrerade.</p>}</div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Dokumentmetadata</h2>
            <form action={createEntityDocumentAction} className="mt-4 grid gap-3">
              <input type="hidden" name="entity_id" value={entity.id} />
              <Field label="Filnamn"><input name="file_name" required className={inputClassName} placeholder="avtal.pdf" /></Field>
              <Field label="Storage path / referens"><input name="storage_path" required className={inputClassName} placeholder="company/entity/file.pdf" /></Field>
              <Field label="Dokumenttyp"><input name="document_type" className={inputClassName} placeholder="Avtal, bild, instruktion" /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till dokument</button>
            </form>
            <div className="mt-4 space-y-3">{documents?.length ? documents.map((doc) => <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{doc.file_name}</p><p className="mt-1 text-sm text-slate-500">{doc.document_type ?? 'Dokument'} · {doc.storage_path}</p></div>) : <p className="text-sm text-slate-600">Inga dokument registrerade.</p>}</div>
          </section>

          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Noteringar</h2><div className="mt-4 space-y-3">{notes?.length ? notes.map((note) => <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm leading-6 text-slate-700">{note.note}</p><p className="mt-2 text-xs text-slate-400">{note.visibility} · {new Date(note.created_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Inga noteringar ännu.</p>}</div></section>
        </div>
      </div>
    </AppShell>
  )
}
