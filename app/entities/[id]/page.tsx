export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveEntityAction, updateEntityAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params
  const [{ data: entity }, { data: entityTypes }, { data: teams }, { data: addresses }, { data: contacts }] = await Promise.all([
    supabaseAdmin.from('entities').select('*, entity_types(label_singular, label_plural)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('entity_types').select('id, label_singular, label_plural').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('entity_addresses').select('*').eq('entity_id', id).order('is_primary', { ascending: false }),
    supabaseAdmin.from('entity_contacts').select('*').eq('entity_id', id).order('is_primary', { ascending: false }),
  ])
  if (!entity) notFound()

  return (
    <AppShell auth={auth} title={entity.name} subtitle={`${entity.entity_types?.label_singular ?? 'Objekt'} · status och kärnuppgifter.`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <FormCard title="Redigera objekt">
          <form action={updateEntityAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={entity.id} />
            <Field label="Objekttyp"><select name="entity_type_id" defaultValue={entity.entity_type_id} required className={selectClassName}>{entityTypes?.map((type) => <option key={type.id} value={type.id}>{type.label_singular}</option>)}</select></Field>
            <Field label="Namn"><input name="name" required defaultValue={entity.name} className={inputClassName} /></Field>
            <Field label="Externt ID"><input name="external_id" defaultValue={entity.external_id ?? ''} className={inputClassName} /></Field>
            <Field label="Team"><select name="primary_team_id" defaultValue={entity.primary_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Status"><select name="status" defaultValue={entity.status} className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
            <Field label="Prioritet"><select name="priority" defaultValue={entity.priority} className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
            <div className="sm:col-span-2"><Field label="Sammanfattning"><textarea name="summary" defaultValue={entity.summary ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><Field label="Instruktioner"><textarea name="instructions" defaultValue={entity.instructions ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
          </form>
        </FormCard>
        <div className="space-y-5">
          <section className="coordiqo-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={entity.status} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete så historik, relationer och kommande uppdrag inte tappas.</p><form action={archiveEntityAction} className="mt-4"><input type="hidden" name="id" value={entity.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera objekt</button></form></section>
          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Adresser</h2><div className="mt-4 space-y-3">{addresses?.length ? addresses.map((address) => <div key={address.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{address.label}</p><p className="mt-1 text-sm text-slate-500">{[address.street, address.postal_code, address.city].filter(Boolean).join(', ')}</p></div>) : <p className="text-sm text-slate-600">Ingen adress registrerad.</p>}</div></section>
          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Kontakter</h2><div className="mt-4 space-y-3">{contacts?.length ? contacts.map((contact) => <div key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{contact.name}</p><p className="mt-1 text-sm text-slate-500">{contact.role_label ?? 'Kontakt'} · {contact.phone ?? contact.email ?? 'saknar kontaktväg'}</p></div>) : <p className="text-sm text-slate-600">Ingen kontakt registrerad.</p>}</div></section>
        </div>
      </div>
    </AppShell>
  )
}
