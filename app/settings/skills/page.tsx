export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { archiveCertificationAction, archiveSkillAction, createCertificationAction, createSkillAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SkillsSettingsPage() {
  const auth = await requireCompanyContext()

  const [{ data: skills }, { data: certifications }, { data: rules }] = await Promise.all([
    supabaseAdmin.from('skills').select('*').eq('company_id', auth.membership.companyId).is('archived_at', null).order('category').order('name'),
    supabaseAdmin.from('certifications').select('*').eq('company_id', auth.membership.companyId).is('archived_at', null).order('category').order('name'),
    supabaseAdmin.from('assignment_rules').select('*').eq('company_id', auth.membership.companyId).is('archived_at', null).order('severity').order('name'),
  ])

  return (
    <AppShell auth={auth} title="Kompetenser & regler" subtitle="Styr vem som får göra vad med kompetenser, certifikat och regelkontroll.">
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <FormCard title="Skapa eller uppdatera kompetens" description="Koden är unik per företag. Om samma kod redan finns uppdateras kompetensen istället för att krascha.">
            <form action={createSkillAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Ex. Nyckelhantering" /></Field>
              <Field label="Kod"><input name="code" className={inputClassName} placeholder="key_handling eller lämna tomt för auto-kod" /></Field>
              <Field label="Kategori"><input name="category" className={inputClassName} placeholder="general / care / property" /></Field>
              <Field label="Status"><select name="is_active" defaultValue="true" className={selectClassName}><option value="true">Aktiv</option><option value="false">Inaktiv</option></select></Field>
              <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara kompetens</button></div>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Kompetensregister</h2>
            <div className="mt-4 space-y-3">
              {skills?.length ? skills.map((skill: any) => (
                <div key={skill.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold text-slate-950">{skill.name}</p><p className="mt-1 text-sm text-slate-500">{skill.code} · {skill.category}</p>{skill.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{skill.description}</p> : null}</div>
                    <div className="flex items-center gap-2"><StatusBadge status={skill.is_active ? 'active' : 'inactive'} /><form action={archiveSkillAction}><input type="hidden" name="id" value={skill.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Arkivera</button></form></div>
                  </div>
                </div>
              )) : <EmptyState title="Inga kompetenser" description="Skapa kompetenser som senare kan krävas på uppdrag och kopplas till personal." />}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <FormCard title="Skapa eller uppdatera certifikat" description="Koden är unik per företag. Om samma kod redan finns uppdateras certifikatet istället för att skapa dubblett.">
            <form action={createCertificationAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Ex. B-körkort" /></Field>
              <Field label="Kod"><input name="code" className={inputClassName} placeholder="drivers_license_b eller lämna tomt för auto-kod" /></Field>
              <Field label="Kategori"><input name="category" className={inputClassName} placeholder="transport / compliance" /></Field>
              <Field label="Kräver utgångsdatum"><select name="requires_expiry" defaultValue="true" className={selectClassName}><option value="true">Ja</option><option value="false">Nej</option></select></Field>
              <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara certifikat</button></div>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Certifikatregister</h2>
            <div className="mt-4 space-y-3">
              {certifications?.length ? certifications.map((cert: any) => (
                <div key={cert.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold text-slate-950">{cert.name}</p><p className="mt-1 text-sm text-slate-500">{cert.code} · {cert.category}</p>{cert.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{cert.description}</p> : null}</div>
                    <div className="flex items-center gap-2"><StatusBadge status={cert.requires_expiry ? 'expires' : 'no_expiry'} /><form action={archiveCertificationAction}><input type="hidden" name="id" value={cert.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Arkivera</button></form></div>
                  </div>
                </div>
              )) : <EmptyState title="Inga certifikat" description="Skapa certifikat som kan krävas på uppdrag och följas på personal." />}
            </div>
          </section>
        </div>
      </div>

      <section className="coordiqo-card mt-5 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Regelmotor v1</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Dessa basregler används när du kör regelkontroll på ett uppdrag. Hårda regler blockerar, mjuka regler varnar.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {rules?.map((rule: any) => <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4"><StatusBadge status={rule.severity} /><p className="mt-3 font-semibold text-slate-950">{rule.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">{rule.description}</p></div>)}
        </div>
      </section>
    </AppShell>
  )
}
