export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormCard, inputClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageEntityTypes } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { createEntityTypeAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function EntityTypesPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const canManage = canManageEntityTypes(auth.membership.companyRole)

  const { data: entityTypes, error } = await supabaseAdmin
    .from('entity_types')
    .select('id, code, label_singular, label_plural, description, source, is_active, sort_order')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('sort_order')

  return (
    <AppShell auth={auth} title="Objekttyper" subtitle="Konfigurera företagets dynamiska objektmodell utan att låsa branschen i kod.">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <FormCard title="Skapa objekttyp" description="Exempel: Fastighet, Lägenhet, Kund, Vårdtagare, Projekt, Zon eller Servicepunkt.">
          {canManage ? (
            <form action={createEntityTypeAction} className="grid gap-4">
              <Field label="Kod"><input name="code" required className={inputClassName} placeholder="property, unit, customer" /></Field>
              <Field label="Singular"><input name="label_singular" required className={inputClassName} placeholder="Fastighet" /></Field>
              <Field label="Plural"><input name="label_plural" required className={inputClassName} placeholder="Fastigheter" /></Field>
              <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa objekttyp</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">Du saknar behörighet för att skapa objekttyper.</p>
          )}
        </FormCard>

        <section className="space-y-4">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
          {!entityTypes?.length ? (
            <EmptyState eyebrow="Batch 4B" title="Inga objekttyper ännu" description="Skapa första objekttypen eller kör branschpresets igen via branschmotorn." />
          ) : (
            entityTypes.map((type) => (
              <Link key={type.id} href={`/settings/entity-types/${type.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{type.code} · {type.source}</p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-950">{type.label_plural}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{type.description ?? 'Ingen beskrivning.'}</p>
                  </div>
                  <StatusBadge status={type.is_active ? 'active' : 'inactive'} />
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </AppShell>
  )
}
