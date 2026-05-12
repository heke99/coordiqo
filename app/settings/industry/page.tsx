export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { CORE_MODULES } from '@/lib/industry/config'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function IndustrySettingsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: modules }, { data: entityTypes }, { data: presets }] = await Promise.all([
    supabaseAdmin
      .from('company_modules')
      .select('module_code, status')
      .eq('company_id', auth.membership.companyId)
      .order('module_code', { ascending: true }),
    supabaseAdmin
      .from('entity_types')
      .select('code, label_singular, label_plural, description, is_active')
      .eq('company_id', auth.membership.companyId)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('industry_entity_presets')
      .select('entity_code, label_singular, label_plural, description')
      .eq('industry_code', auth.membership.industryType ?? 'other')
      .order('sort_order', { ascending: true }),
  ])

  const moduleStatus = new Map((modules ?? []).map((module) => [module.module_code, module.status]))

  return (
    <AppShell
      auth={auth}
      title="Branschmotor"
      subtitle="Styr vilka moduler, ord, objektstyper och arbetsmönster som ska gälla för företaget."
    >
      <div className="space-y-6">
        <section className="coordiqo-card p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="coordiqo-badge coordiqo-badge--info">Branschmotor</div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Branschstyrning utan låst objektmodell</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                Företaget är just nu konfigurerat som <strong>{auth.membership.industryLabel}</strong> med modellen <strong>{auth.membership.operationalModelLabel}</strong>. Det betyder inte att objektmodellen är fastlåst. Presets skapar en bra start, och företaget kan senare lägga till egna typer.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Aktiv tenant</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{auth.membership.companyName}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Bransch</dt>
                  <dd className="font-semibold text-slate-900">{auth.membership.industryLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Operativ modell</dt>
                  <dd className="font-semibold text-slate-900">{auth.membership.operationalModelLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Label set</dt>
                  <dd className="font-semibold text-slate-900">{auth.membership.uiLabelSet ?? 'standard'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="coordiqo-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">Moduler</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Moduler kan aktiveras per företag och senare kopplas till abonnemang, roller och feature flags.</p>
            <div className="mt-5 space-y-3">
              {CORE_MODULES.map((module) => {
                const status = moduleStatus.get(module.code) ?? (auth.membership?.activeModules.includes(module.code) ? 'active' : 'planned')
                return (
                  <div key={module.code} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{module.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{module.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="coordiqo-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">Objektpresets för branschen</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Presets är bara startförslag. De är inte en låsning.</p>
            <div className="mt-5 space-y-3">
              {(presets ?? []).map((preset) => (
                <div key={preset.entity_code} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">{preset.label_plural}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{preset.description ?? `${preset.label_singular} kan användas som objekt i detta branschläge.`}</p>
                </div>
              ))}
              {(!presets || presets.length === 0) && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Inga presets finns för vald bransch ännu. Företaget kan ändå få egna objekttyper i kommande batch.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-6">
          <h2 className="text-xl font-semibold text-slate-950">Aktiva objekttyper för företaget</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Dessa typer kommer från branschpreset vid onboarding och kan senare utökas per företag.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(entityTypes ?? []).map((type) => (
              <div key={type.code} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{type.code}</p>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{type.label_plural}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{type.description ?? type.label_singular}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
