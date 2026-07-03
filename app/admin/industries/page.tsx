export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getIndustryRegistry, getOperationalModels } from '@/lib/industry/registry'
import { createIndustryProfileAction, updateIndustryProfileAction } from '@/lib/platform/admin-actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminIndustriesPage() {
  const auth = await requirePlatformAdmin()

  const [registry, operationalModels, { data: companies }] = await Promise.all([
    getIndustryRegistry(),
    getOperationalModels(),
    supabaseAdmin.from('companies').select('industry_type').is('archived_at', null),
  ])

  const companyCountByIndustry = new Map<string, number>()
  for (const company of companies ?? []) {
    const code = company.industry_type ?? 'other'
    companyCountByIndustry.set(code, (companyCountByIndustry.get(code) ?? 0) + 1)
  }

  return (
    <AppShell
      auth={auth}
      title="Branscher"
      subtitle="Hantera branschregistret. Nya branscher kan läggas till här utan kodändringar — de blir direkt valbara i setup, demo-formulär och onboarding."
    >
      <div className="space-y-5">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Lägg till bransch</h2>
          <p className="mt-1 text-sm text-slate-600">Nya branscher börjar med neutralt standardinnehåll (som Annan verksamhet) och en komplett onboarding-mall. Innehållet kan sedan justeras.</p>
          <form action={createIndustryProfileAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Kod (a-z, _)"><input name="code" required className={inputClassName} placeholder="ex. lantbruk" /></Field>
            <Field label="Namn (svenska)"><input name="name_sv" required className={inputClassName} placeholder="Lantbruk" /></Field>
            <Field label="Namn (engelska)"><input name="name_en" className={inputClassName} placeholder="Agriculture" /></Field>
            <div className="md:col-span-2"><Field label="Beskrivning (svenska)"><input name="description_sv" className={inputClassName} /></Field></div>
            <Field label="Primärt arbetssätt">
              <select name="default_operational_model" className={selectClassName}>
                {operationalModels.map((model) => <option key={model.code} value={model.code}>{model.label}</option>)}
              </select>
            </Field>
            <div className="md:col-span-3">
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa bransch</button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          {registry.map((profile) => (
            <div key={profile.code} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{profile.nameSv}</h2>
                    <StatusBadge status={profile.isActive ? 'Aktiv' : 'Arkiverad'} tone={profile.isActive ? 'success' : 'neutral'} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Kod: {profile.code} · {companyCountByIndustry.get(profile.code) ?? 0} bolag använder branschen</p>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">{profile.descriptionSv}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.taskTypes.slice(0, 6).map((taskType) => (
                      <span key={taskType} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{taskType}</span>
                    ))}
                  </div>
                </div>
                <form action={updateIndustryProfileAction} className="grid w-full max-w-md gap-3">
                  <input type="hidden" name="code" value={profile.code} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Namn (sv)"><input name="name_sv" defaultValue={profile.nameSv} className={inputClassName} /></Field>
                    <Field label="Sortering"><input name="sort_order" type="number" defaultValue={profile.sortOrder} className={inputClassName} /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Primärt arbetssätt">
                      <select name="default_operational_model" defaultValue={profile.defaultOperationalModel} className={selectClassName}>
                        {operationalModels.map((model) => <option key={model.code} value={model.code}>{model.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select name="is_active" defaultValue={profile.isActive ? 'true' : 'false'} className={selectClassName}>
                        <option value="true">Aktiv</option>
                        <option value="false">Arkiverad</option>
                      </select>
                    </Field>
                  </div>
                  <button className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Spara</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
