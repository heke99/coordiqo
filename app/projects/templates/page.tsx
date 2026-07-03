export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createProjectTemplateAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const defaultQuestionsJson = JSON.stringify([
  { key: 'square_meters', label: 'Antal kvm', type: 'number', unit: 'kvm', required: true },
  { key: 'rooms', label: 'Antal rum', type: 'number', unit: 'rum' },
  { key: 'planned_workers', label: 'Antal personal', type: 'number', required: true }
], null, 2)

const defaultRulesJson = JSON.stringify([
  { key: 'planning', phase: 'planning', title: 'Projektgenomgång', quantity_source: 'fixed', minutes_per_unit: 180, minimum_minutes: 180 },
  { key: 'execution', phase: 'execution', title: 'Utförande', quantity_source: 'square_meters', minutes_per_unit: 30, material_cost_per_unit: 100 },
  { key: 'followup', phase: 'followup', title: 'Slutkontroll', quantity_source: 'fixed', minutes_per_unit: 120, minimum_minutes: 120 }
], null, 2)

export default async function ProjectTemplatesPage() {
  const auth = await requireCompanyContext()

  const [{ data: templates }, { data: rules }, { data: questions }] = await Promise.all([
    supabaseAdmin
      .from('project_templates')
      .select('id, name, description, scope, industry_type, project_type, status, created_at')
      .is('archived_at', null)
      .or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`)
      .order('scope')
      .order('name'),
    supabaseAdmin
      .from('project_estimation_rules')
      .select('id, project_template_id')
      .or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`)
      .is('archived_at', null),
    supabaseAdmin
      .from('project_template_questions')
      .select('id, project_template_id')
      .or(`company_id.is.null,company_id.eq.${auth.membership.companyId}`)
      .is('archived_at', null),
  ])

  const ruleCountByTemplate = new Map<string, number>()
  for (const rule of rules ?? []) ruleCountByTemplate.set(rule.project_template_id, (ruleCountByTemplate.get(rule.project_template_id) ?? 0) + 1)
  const questionCountByTemplate = new Map<string, number>()
  for (const question of questions ?? []) questionCountByTemplate.set(question.project_template_id, (questionCountByTemplate.get(question.project_template_id) ?? 0) + 1)

  return (
    <AppShell
      auth={auth}
      title="Projektmallar"
      subtitle="Systempresets och egna företagsmallar med frågor, arbetsmoment och kalkylregler."
      actions={<div className="flex gap-2"><Link href="/projects" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Till projekt</Link><Link href="/projects/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Nytt projekt</Link></div>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Tillgängliga mallar</h2>
          <div className="mt-4 space-y-3">
            {templates?.length ? templates.map((template: any) => (
              <div key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{template.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{template.description ?? 'Ingen beskrivning.'}</p>
                    <p className="mt-2 text-xs text-slate-400">{questionCountByTemplate.get(template.id) ?? 0} frågor · {ruleCountByTemplate.get(template.id) ?? 0} regler · {template.project_type}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><StatusBadge status={template.scope === 'system' ? 'system' : 'egen'} /><StatusBadge status={template.status} /></div>
                </div>
              </div>
            )) : <EmptyState eyebrow="Projektmallar" title="Inga projektmallar ännu" description="Skapa första företagsmallen eller använd systempresets när migrationen är körd." />}
          </div>
        </section>

        <FormCard title="Skapa egen projektmall" description="AI kan hjälpa till med struktur, men du definierar frågor och regler som systemet sedan använder vid projektskapande.">
          <form action={createProjectTemplateAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mallnamn"><input name="name" required className={inputClassName} placeholder="Ex. Standardrenovering" /></Field>
              <Field label="Projektkategori"><input name="project_type" defaultValue="custom_project" className={inputClassName} /></Field>
            </div>
            <Field label="Beskrivning"><textarea name="description" className={textareaClassName} placeholder="När ska mallen användas?" /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bransch"><input name="industry_type" defaultValue={auth.membership.industryType ?? 'custom'} className={inputClassName} /></Field>
              <Field label="Timpris"><input name="labor_rate_per_hour" type="number" min="0" defaultValue="550" className={inputClassName} /></Field>
              <Field label="Valuta"><select name="currency" defaultValue="SEK" className={selectClassName}><option value="SEK">SEK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></Field>
            </div>
            <Field label="Faser JSON"><textarea name="default_phase_model_json" className={textareaClassName} rows={4} defaultValue={JSON.stringify([{ key: 'planning', name: 'Planering' }, { key: 'execution', name: 'Utförande' }, { key: 'followup', name: 'Uppföljning' }], null, 2)} /></Field>
            <Field label="Frågor JSON"><textarea name="questions_json" className={textareaClassName} rows={8} defaultValue={defaultQuestionsJson} /></Field>
            <Field label="Kalkylregler JSON"><textarea name="rules_json" className={textareaClassName} rows={10} defaultValue={defaultRulesJson} /></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara projektmall</button>
          </form>
        </FormCard>
      </div>
    </AppShell>
  )
}
