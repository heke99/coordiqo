export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function EntitiesPage() {
  const auth = await requireAuth()

  if (!auth.membership) return null

  const { data: entityTypes } = await supabaseAdmin
    .from('entity_types')
    .select('code, label_singular, label_plural, description, is_active')
    .eq('company_id', auth.membership.companyId)
    .order('sort_order', { ascending: true })

  return (
    <AppShell auth={auth} title="Objekt" subtitle="Branschstyrda objektstyper utan att låsa företaget vid en enda modell.">
      <div className="space-y-6">
        <EmptyState
          eyebrow="Dynamisk objektmodell"
          title="Objektmodellen styrs av bransch och kan anpassas per företag"
          description="Coordiqo ska inte låsa ett företag till kund, patient, fastighet eller projekt. Batch 2 skapar därför en registry för objekttyper som kan bytas, utökas och döpas om per tenant."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(entityTypes ?? []).map((type) => (
            <div key={type.code} className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">{type.code}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{type.label_plural}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{type.description ?? `${type.label_singular} är aktiverad för detta företag.`}</p>
              <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${type.is_active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                {type.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
