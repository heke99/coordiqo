export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { TaskForm } from '@/components/tasks/task-form'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { archiveTaskAction, archiveTaskRequirementAction, createTaskCommentAction, createTaskRequirementAction, resolveRuleViolationAction, runTaskRuleCheckAction, updateTaskAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: task }, { data: taskTypes }, { data: entities }, { data: teams }, { data: staff }, { data: workOrders }, { data: comments }, { data: history }, { data: skills }, { data: certifications }, { data: requirements }, { data: violations }] = await Promise.all([
    supabaseAdmin.from('tasks').select('*, entities(name), teams(name), staff_profiles(full_name), task_types(name), work_orders(title)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('task_types').select('id, name').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('entities').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(200),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('work_orders').select('id, title').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('task_comments').select('id, comment, visibility, created_at').eq('company_id', auth.membership.companyId).eq('task_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('task_status_history').select('id, old_status, new_status, reason, created_at').eq('company_id', auth.membership.companyId).eq('task_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('skills').select('id, name, category').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('certifications').select('id, name, category').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('task_requirements').select('id, requirement_kind, skill_id, certification_id, required_value, is_hard_requirement, description, skills(name), certifications(name)').eq('company_id', auth.membership.companyId).eq('task_id', id).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('rule_violations').select('id, severity, status, violation_code, message, created_at, staff_profiles(full_name)').eq('company_id', auth.membership.companyId).eq('task_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(30),
  ])

  if (!task) notFound()

  return (
    <AppShell auth={auth} title={task.title} subtitle="Uppdragsdetaljer, status, tilldelning, tidsfönster och kommentarer.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <FormCard title="Redigera uppdrag">
          <TaskForm action={updateTaskAction} task={task} taskTypes={taskTypes ?? []} entities={entities ?? []} teams={teams ?? []} staff={staff ?? []} workOrders={workOrders ?? []} submitLabel="Spara uppdrag" industryType={auth.membership.industryType} />
        </FormCard>

        <div className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Status</h2>
              <div className="flex gap-2"><StatusBadge status={task.priority} /><StatusBadge status={task.status} /></div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete. Uppdragets historik och audit-spår behålls.</p>
            <form action={archiveTaskAction} className="mt-4">
              <input type="hidden" name="id" value={task.id} />
              <button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera uppdrag</button>
            </form>
          </section>

          
          <FormCard title="Uppdragskrav" description="Lägg krav som regelmotorn använder när personal tilldelas. Hårda krav ska blockera fel matchning, mjuka krav varnar.">
            <form action={createTaskRequirementAction} className="grid gap-4">
              <input type="hidden" name="task_id" value={task.id} />
              <Field label="Typ av krav"><select name="requirement_kind" defaultValue="skill" className={selectClassName}><option value="skill">Kompetens</option><option value="certification">Certifikat</option><option value="transport_mode">Färdsätt</option><option value="double_staffing">Dubbelbemanning</option><option value="custom">Eget krav</option></select></Field>
              <Field label="Kompetens"><select name="skill_id" className={selectClassName}><option value="">Ingen</option>{skills?.map((skill: any) => <option key={skill.id} value={skill.id}>{skill.name} · {skill.category}</option>)}</select></Field>
              <Field label="Certifikat"><select name="certification_id" className={selectClassName}><option value="">Inget</option>{certifications?.map((cert: any) => <option key={cert.id} value={cert.id}>{cert.name} · {cert.category}</option>)}</select></Field>
              <Field label="Värde"><input name="required_value" className={inputClassName} placeholder="Ex. car, service_vehicle eller egen regeltext" /></Field>
              <Field label="Kravnivå"><select name="is_hard_requirement" defaultValue="true" className={selectClassName}><option value="true">Hårt krav</option><option value="false">Mjukt krav</option></select></Field>
              <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till krav</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Aktiva krav</h2>
            <div className="mt-4 space-y-3">{requirements?.length ? requirements.map((requirement: any) => <div key={requirement.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{requirement.skills?.name ?? requirement.certifications?.name ?? requirement.required_value ?? requirement.requirement_kind}</p><p className="mt-1 text-sm text-slate-500">{requirement.requirement_kind} · {requirement.is_hard_requirement ? 'hårt krav' : 'mjukt krav'}</p>{requirement.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{requirement.description}</p> : null}</div><form action={archiveTaskRequirementAction}><input type="hidden" name="id" value={requirement.id} /><input type="hidden" name="task_id" value={task.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Ta bort</button></form></div></div>) : <p className="text-sm text-slate-600">Inga krav tillagda ännu.</p>}</div>
          </section>

          <FormCard title="Regelkontroll">
            <form action={runTaskRuleCheckAction} className="grid gap-4">
              <input type="hidden" name="task_id" value={task.id} />
              <Field label="Kontrollera personal"><select name="staff_profile_id" defaultValue={task.assigned_staff_id ?? ''} required className={selectClassName}><option value="">Välj personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Kör regelkontroll</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Regelbrott</h2>
            <div className="mt-4 space-y-3">{violations?.length ? violations.map((violation: any) => <div key={violation.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><StatusBadge status={violation.severity} /><p className="mt-3 font-semibold text-slate-950">{violation.message}</p><p className="mt-1 text-sm text-slate-500">{violation.staff_profiles?.full_name ?? 'Ej kopplad personal'} · {violation.status}</p></div>{violation.status === 'open' ? <form action={resolveRuleViolationAction}><input type="hidden" name="id" value={violation.id} /><input type="hidden" name="task_id" value={task.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Markera löst</button></form> : null}</div></div>) : <p className="text-sm text-slate-600">Inga regelbrott registrerade.</p>}</div>
          </section>

          <FormCard title="Ny kommentar">
            <form action={createTaskCommentAction} className="grid gap-4">
              <input type="hidden" name="task_id" value={task.id} />
              <Field label="Synlighet"><select name="visibility" defaultValue="internal" className={selectClassName}><option value="internal">Intern</option><option value="staff">Personal</option><option value="external">Extern/portal senare</option></select></Field>
              <Field label="Kommentar"><textarea name="comment" required className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till kommentar</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Kommentarer</h2>
            <div className="mt-4 space-y-3">{comments?.length ? comments.map((comment) => <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm leading-6 text-slate-700">{comment.comment}</p><p className="mt-2 text-xs text-slate-400">{comment.visibility} · {new Date(comment.created_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Inga kommentarer ännu.</p>}</div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Statushistorik</h2>
            <div className="mt-4 space-y-3">{history?.length ? history.map((event) => <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-950">{event.old_status ?? 'start'} → {event.new_status}</p><p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Ingen statuslogg ännu.</p>}</div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
