export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createProjectAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function ProjectWizardPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: templates }, { data: entities }, { data: teams }, { data: staff }] = await Promise.all([
    supabaseAdmin.from('project_templates').select('id, name, description, scope, industry_type').is('archived_at', null).eq('status', 'active').or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`).order('name'),
    supabaseAdmin.from('entities').select('id, display_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('display_name').limit(200),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
  ])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell auth={auth} title="Projektguide" subtitle="Skapa ett projekt steg för steg med tydlig kalkylgrund och nästa steg.">
      <form action={createProjectAction} className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-slate-300">Steg 1</p>
          <h2 className="mt-1 text-2xl font-semibold">Vad ska göras?</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Projektmall"><select name="project_template_id" className={selectClassName}><option value="">Annat/eget projekt</option>{(templates ?? []).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
            <Field label="Projektnamn"><input name="name" required className={inputClassName} /></Field>
          </div>
          <div className="mt-4"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="coordiqo-card p-5">
            <p className="text-sm font-semibold text-slate-500">Steg 2</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Kund, plats och tid</h2>
            <div className="mt-4 grid gap-4">
              <Field label="Kund/objekt"><select name="entity_id" className={selectClassName}><option value="">Välj senare</option>{(entities ?? []).map((entity) => <option key={entity.id} value={entity.id}>{entity.display_name}</option>)}</select></Field>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Start"><input name="target_start_date" type="date" defaultValue={today} className={inputClassName} /></Field><Field label="Deadline"><input name="deadline_date" type="date" className={inputClassName} /></Field></div>
              <Field label="Budget"><input name="budget_amount" type="number" step="1000" className={inputClassName} /></Field>
            </div>
          </div>

          <div className="coordiqo-card p-5">
            <p className="text-sm font-semibold text-slate-500">Steg 3</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Drivare för kalkyl</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Kvm"><input name="square_meters" type="number" defaultValue="0" className={inputClassName} /></Field>
              <Field label="Rum"><input name="rooms" type="number" defaultValue="0" className={inputClassName} /></Field>
              <Field label="Fönster"><input name="windows" type="number" defaultValue="0" className={inputClassName} /></Field>
              <Field label="Personal"><input name="planned_workers" type="number" min="1" defaultValue="2" className={inputClassName} /></Field>
              <Field label="Prioritet"><select name="priority" defaultValue="normal" className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
              <Field label="Omfattning"><select name="scope" defaultValue="hela" className={selectClassName}><option value="hela">Hela</option><option value="delar">Delar</option><option value="annat">Annat</option></select></Field>
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <p className="text-sm font-semibold text-slate-500">Steg 4</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Ansvar och nästa steg</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Team"><select name="default_team_id" className={selectClassName}><option value="">Välj senare</option>{(teams ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Personal"><select name="default_staff_profile_id" className={selectClassName}><option value="">Välj senare</option>{(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Skapa uppdrag"><select name="create_tasks" defaultValue="true" className={selectClassName}><option value="true">Ja, skapa arbetsmoment</option><option value="false">Nej, bara projekt</option></select></Field>
          </div>
          <input type="hidden" name="ai_assist_status" value="not_used" />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa projekt</button>
            <Link href="/projects" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">Till projektlistan</Link>
          </div>
        </section>
      </form>
    </AppShell>
  )
}

