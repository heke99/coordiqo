export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { requireAuth } from '@/lib/auth/session'
import { createProjectAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams

  const [{ data: templates }, { data: entities }, { data: teams }, { data: staff }] = await Promise.all([
    supabaseAdmin
      .from('project_templates')
      .select('id, name, description, scope, industry_type, project_type')
      .is('archived_at', null)
      .eq('status', 'active')
      .or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`)
      .order('scope')
      .order('name'),
    supabaseAdmin.from('entities').select('id, display_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('display_name').limit(200),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
  ])

  const visibleTemplates = (templates ?? []).filter((template: any) => template.scope === 'company' || !template.industry_type || template.industry_type === auth.membership?.industryType)
  const selectedTemplate = visibleTemplates.find((template: any) => template.id === params.template) ?? visibleTemplates[0]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell auth={auth} title="Nytt projekt" subtitle="Skapa projekt från intake. Uppdrag skapas som oschemalagda och kan planeras direkt via planeringsmotorn." actions={<Link href="/projects" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Till projekt</Link>}>
      <FormCard title="Projektintake" description="Välj mall, fyll i drivare som kvm/rum/fönster och låt systemet skapa arbetsmoment och uppdrag från reglerna i databasen.">
        <form action={createProjectAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Projektmall"><select name="project_template_id" defaultValue={selectedTemplate?.id ?? ''} className={selectClassName}><option value="">Annat/eget projekt</option>{visibleTemplates.map((template: any) => <option key={template.id} value={template.id}>{template.scope === 'company' ? 'Egen' : 'System'} · {template.name}</option>)}</select></Field>
            <Field label="Projektnamn"><input name="name" required className={inputClassName} placeholder="Ex. Renovering fastighet A" /></Field>
          </div>

          <Field label="Beskrivning"><textarea name="description" className={textareaClassName} placeholder="Vad ska göras? Ex. renovera hela fastigheten, vissa rum, fönster eller gemensamma ytor." /></Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Objekt/fastighet"><select name="entity_id" className={selectClassName}><option value="">Inget objekt valt</option>{entities?.map((entity: any) => <option key={entity.id} value={entity.id}>{entity.display_name}</option>)}</select></Field>
            <Field label="Startdatum"><input name="target_start_date" type="date" defaultValue={today} className={inputClassName} /></Field>
            <Field label="Deadline"><input name="deadline_date" type="date" className={inputClassName} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Antal kvm"><input name="square_meters" type="number" min="0" step="1" defaultValue="0" className={inputClassName} /></Field>
            <Field label="Antal rum"><input name="rooms" type="number" min="0" step="1" defaultValue="0" className={inputClassName} /></Field>
            <Field label="Antal fönster"><input name="windows" type="number" min="0" step="1" defaultValue="0" className={inputClassName} /></Field>
            <Field label="Antal personal"><input name="planned_workers" type="number" min="1" step="1" defaultValue="4" className={inputClassName} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Omfattning"><select name="scope" defaultValue="hela" className={selectClassName}><option value="hela">Hela</option><option value="delar">Delar</option><option value="rum">Rum</option><option value="fönster">Fönster</option><option value="annat">Annat</option></select></Field>
            <Field label="Budget"><input name="budget_amount" type="number" min="0" step="1000" className={inputClassName} /></Field>
            <Field label="Prioritet"><select name="priority" defaultValue="normal" className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
            <Field label="Skapa uppdrag"><select name="create_tasks" defaultValue="true" className={selectClassName}><option value="true">Ja</option><option value="false">Nej, bara kalkyl</option></select></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Standardteam"><select name="default_team_id" className={selectClassName}><option value="">Inget team</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Standardpersonal"><select name="default_staff_profile_id" className={selectClassName}><option value="">Ingen personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">AI-assistans senare</p>
            <p className="mt-1 text-sm text-slate-500">Här sparar vi om LLM har hjälpt till med intake. Själva kalkylen styrs ändå av regler i databasen.</p>
            <input type="hidden" name="ai_assist_status" value="not_used" />
          </section>

          <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa projekt och arbetsmoment</button>
        </form>
      </FormCard>
    </AppShell>
  )
}
