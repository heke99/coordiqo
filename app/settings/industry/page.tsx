export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { OPERATIONAL_MODEL_HELP } from '@/lib/industry/config'
import { getActiveIndustryProfiles, getIndustryProfile, getOperationalModels } from '@/lib/industry/registry'
import { updateCompanyIndustrySettingsAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function IndustrySettingsPage() {
  const auth = await requireCompanyContext()

  const [{ data: runtimeConfig }, { data: taskTypes }, { data: resourceTypes }, industryProfiles, operationalModels] = await Promise.all([
    supabaseAdmin
      .from('industry_runtime_configs')
      .select('*')
      .eq('company_id', auth.membership.companyId)
      .maybeSingle(),
    supabaseAdmin
      .from('task_types')
      .select('id, name, is_active')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('name')
      .limit(100),
    supabaseAdmin
      .from('resource_types')
      .select('id, name, is_active')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('name')
      .limit(100),
    getActiveIndustryProfiles(),
    getOperationalModels(),
  ])

  const activeIndustry = auth.membership.industryType ?? 'other'
  const activeProfile = await getIndustryProfile(activeIndustry)
  const selectedOperationalModel = (runtimeConfig as any)?.operational_model ?? auth.membership.operationalModel ?? activeProfile.defaultOperationalModel

  const modelLabelByCode = new Map(operationalModels.map((model) => [model.code, model.label]))
  const runtimeTerminology = ((runtimeConfig as any)?.terminology ?? {}) as Record<string, string>
  const terminology = {
    ...activeProfile.terminology,
    ...Object.fromEntries(Object.entries(runtimeTerminology).filter(([, value]) => typeof value === 'string' && value)),
  }

  const industryOptions = industryProfiles.some((profile) => profile.code === activeIndustry)
    ? industryProfiles
    : [...industryProfiles, activeProfile]

  const enabledModels = Array.from(new Set([selectedOperationalModel, ...activeProfile.allowedOperationalModels]))

  return (
    <AppShell
      auth={auth}
      title="Bransch och arbetssätt"
      subtitle="Välj företagets primära bransch och arbetssätt. Det styr språk och standardinnehåll, men låser inte bort resten av systemet."
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Aktiv branschprofil</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Välj den profil som bäst beskriver verksamheten just nu. Alla funktioner fortsätter vara aktiva; profilen avgör främst vilka ord, mallar och standardflöden som prioriteras.</p>

          <form action={updateCompanyIndustrySettingsAction} className="mt-5 grid gap-4">
            <Field label="Bransch">
              <select name="industry_type" defaultValue={activeIndustry} className={selectClassName}>
                {industryOptions.map((profile) => (
                  <option key={profile.code} value={profile.code}>{profile.nameSv}</option>
                ))}
              </select>
            </Field>
            <Field label="Primärt arbetssätt">
              <select name="operational_model" defaultValue={selectedOperationalModel} className={selectClassName}>
                {operationalModels.map((model) => (
                  <option key={model.code} value={model.code}>{model.label}</option>
                ))}
              </select>
            </Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara och uppdatera standardinnehåll</button>
          </form>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Nuvarande profil</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{activeProfile.descriptionSv}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {enabledModels.map((model) => <StatusBadge key={model} status={modelLabelByCode.get(model) ?? model} />)}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Primärt arbetssätt: {modelLabelByCode.get(selectedOperationalModel) ?? selectedOperationalModel}. {OPERATIONAL_MODEL_HELP[selectedOperationalModel as keyof typeof OPERATIONAL_MODEL_HELP] ?? 'Arbetssättet används som prioriterad vy, inte som en begränsning.'}</p>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Vad profilen styr</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Ordval i systemet</p>
              <dl className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between gap-3"><dt>Objekt</dt><dd className="font-semibold text-slate-950">{terminology.entities}</dd></div>
                <div className="flex justify-between gap-3"><dt>Uppdrag</dt><dd className="font-semibold text-slate-950">{terminology.tasks}</dd></div>
                <div className="flex justify-between gap-3"><dt>Personal</dt><dd className="font-semibold text-slate-950">{terminology.staff}</dd></div>
                <div className="flex justify-between gap-3"><dt>Rutt</dt><dd className="font-semibold text-slate-950">{terminology.route}</dd></div>
              </dl>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Mobilflöde</p>
              <div className="mt-3 flex flex-wrap gap-2">{activeProfile.mobileActions.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>)}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Planeringsregler</p>
              <div className="mt-3 flex flex-wrap gap-2">{activeProfile.planningRules.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>)}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Statusar</p>
              <div className="mt-3 flex flex-wrap gap-2">{activeProfile.statuses.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>)}</div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Uppdragstyper i företaget</h2>
          <p className="mt-1 text-sm text-slate-600">När du sparar skapas saknade standardtyper. Egna typer tas inte bort och gamla data ligger kvar.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {taskTypes?.length ? taskTypes.map((type: any) => <span key={type.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{type.name}</span>) : activeProfile.taskTypes.map((name) => <span key={name} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{name}</span>)}
          </div>
        </section>
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Resurstyper i företaget</h2>
          <p className="mt-1 text-sm text-slate-600">Används av resursansvar och smart planering. Egna resurstyper ligger kvar och kan kombineras med alla branscher.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {resourceTypes?.length ? resourceTypes.map((type: any) => <span key={type.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{type.name}</span>) : activeProfile.resourceTypes.map((name) => <span key={name} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{name}</span>)}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
