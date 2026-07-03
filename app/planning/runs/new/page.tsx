export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName } from '@/components/ui/form-card'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createPlanningRunAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewPlanningRunPage() {
  const auth = await requireCompanyContext()

  const [{ data: teams }, { data: staff }, { data: taskTypes }, { data: projects }] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
    supabaseAdmin.from('task_types').select('id, name').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('projects').select('id, name, status').eq('company_id', auth.membership.companyId).in('status', ['draft', 'estimating', 'planned', 'active', 'paused']).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell
      auth={auth}
      title="Ny planeringskörning"
      subtitle="Skapa ett utkast från uppdrag, projekt eller ett vanligt filter. Motorn publicerar aldrig direkt."
      actions={<div className="flex gap-2"><Link href="/planning/assistant" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">AI-assistent</Link><Link href="/planning" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Till planering</Link></div>}
    >
      <FormCard title="Körningsfilter" description="Välj period, projekt, team/person och om endast oschemalagda uppdrag ska tas med.">
        <form action={createPlanningRunAction} className="grid gap-5">
          <Field label="Namn"><input name="name" className={inputClassName} placeholder="Ex. Morgonplanering område A" /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Från datum"><input name="date_from" type="date" required defaultValue={today} className={inputClassName} /></Field>
            <Field label="Till datum"><input name="date_to" type="date" required defaultValue={today} className={inputClassName} /></Field>
          </div>
          <Field label="Projekt"><select name="project_id" className={selectClassName}><option value="">Ingen projektfiltrering</option>{projects?.map((project: any) => <option key={project.id} value={project.id}>{project.name} · {project.status}</option>)}</select></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Team"><select name="team_id" className={selectClassName}><option value="">Alla team</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Personal"><select name="staff_profile_id" className={selectClassName}><option value="">All personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Uppdragstyp"><select name="task_type_id" className={selectClassName}><option value="">Alla typer</option>{taskTypes?.map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Område/zon"><input name="area_label" className={inputClassName} placeholder="Ex. Område A" /></Field>
            <Field label="Uppdrag"><select name="unscheduled_only" defaultValue="true" className={selectClassName}><option value="true">Endast oschemalagda</option><option value="false">Alla relevanta</option></select></Field>
            <Field label="Låsta tilldelningar"><select name="include_locked_assignments" defaultValue="true" className={selectClassName}><option value="true">Ta hänsyn till låsta</option><option value="false">Ignorera låsta i urval</option></select></Field>
          </div>
          <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa planeringsutkast</button>
        </form>
      </FormCard>
    </AppShell>
  )
}
