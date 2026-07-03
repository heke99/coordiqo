export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createAiPlanningAssistantRunAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PlanningAssistantPage() {
  const auth = await requireCompanyContext()

  const [{ data: teams }, { data: staff }, { data: taskTypes }, { data: projects }, { data: requests }] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
    supabaseAdmin.from('task_types').select('id, name').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('projects').select('id, name, status').eq('company_id', auth.membership.companyId).in('status', ['draft', 'estimating', 'planned', 'active', 'paused']).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('planning_ai_requests').select('id, prompt, status, interpreted_intent, result_summary, planning_run_id, created_at, error_message').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(8),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppShell
      auth={auth}
      title="AI-planeringsassistent"
      subtitle="Skapa planeringsutkast från vanlig text, med strukturerade regler, filter och konfliktkontroll."
      actions={<Link href="/planning" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Till planering</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Beskriv vad som ska planeras</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Assistenten tolkar texten till datum, urval, prioriteringar och regler. Den skapar bara ett utkast, aldrig en publicerad plan.
          </p>

          <form action={createAiPlanningAssistantRunAction} className="mt-5 grid gap-5">
            <Field label="Instruktion till planeringsassistenten">
              <textarea
                name="prompt"
                required
                rows={6}
                className={`${inputClassName} min-h-36`}
                placeholder="Ex. Planera måndag för team A. Prioritera kort restid, rätt kompetens och samma personal hos återkommande kunder. Ta bara oschemalagda uppdrag."
              />
            </Field>
            <Field label="Namn på körning"><input name="name" className={inputClassName} placeholder="AI-planering måndag område A" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Från datum"><input name="date_from" type="date" defaultValue={today} className={inputClassName} /></Field>
              <Field label="Till datum"><input name="date_to" type="date" defaultValue={today} className={inputClassName} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Team"><select name="team_id" className={selectClassName}><option value="">Alla team</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
              <Field label="Personal"><select name="staff_profile_id" className={selectClassName}><option value="">All personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
              <Field label="Uppdragstyp"><select name="task_type_id" className={selectClassName}><option value="">Alla typer</option>{taskTypes?.map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Projekt"><select name="project_id" className={selectClassName}><option value="">Alla projekt/uppdrag</option>{projects?.map((project: any) => <option key={project.id} value={project.id}>{project.name} · {project.status}</option>)}</select></Field>
              <Field label="Område/zon"><input name="area_label" className={inputClassName} placeholder="Ex. Norr / Område A" /></Field>
              <Field label="Uppdrag"><select name="unscheduled_only" defaultValue="true" className={selectClassName}><option value="true">Endast oschemalagda</option><option value="false">Alla relevanta</option></select></Field>
            </div>
            <Field label="Låsta tilldelningar"><select name="include_locked_assignments" defaultValue="true" className={selectClassName}><option value="true">Respektera låsta tilldelningar</option><option value="false">Ignorera låsta i urval</option></select></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa AI-planeringsutkast</button>
          </form>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Så tolkar AI-planeraren texten</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p><b className="text-slate-950">AI-assistenten</b> ska vara stöd ovanpå databasregler och motor, inte ensam källa till tider eller kostnad.</p>
              <p><b className="text-slate-950">Planen</b> skapas som draft med kandidater, score och konflikter innan publicering.</p>
              <p><b className="text-slate-950">Regler</b> kommer från pass, personal, kompetenser, certifikat, frånvaro, projekt och uppdrag.</p>
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Senaste assistentkörningar</h2>
            <div className="mt-4 space-y-3">
              {requests?.length ? requests.map((request: any) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-3 text-sm font-semibold text-slate-950">{request.prompt}</p>
                    <StatusBadge status={request.status} tone={request.status === 'failed' ? 'danger' : request.status === 'completed' ? 'success' : 'info'} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{request.interpreted_intent?.explanation ?? request.error_message ?? 'Tolkning saknas.'}</p>
                  {request.planning_run_id ? <Link href={`/planning/runs/${request.planning_run_id}`} className="mt-3 inline-flex text-xs font-semibold text-slate-950">Öppna utkast →</Link> : null}
                </div>
              )) : <p className="text-sm text-slate-600">Inga AI-assistentkörningar ännu.</p>}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
