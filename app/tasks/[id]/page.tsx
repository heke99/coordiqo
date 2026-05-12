export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { TaskForm } from '@/components/tasks/task-form'
import { Field, FormCard, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { archiveTaskAction, createTaskCommentAction, updateTaskAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: task }, { data: taskTypes }, { data: entities }, { data: teams }, { data: staff }, { data: workOrders }, { data: comments }, { data: history }] = await Promise.all([
    supabaseAdmin.from('tasks').select('*, entities(name), teams(name), staff_profiles(full_name), task_types(name), work_orders(title)').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('task_types').select('id, name').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('entities').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(200),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('work_orders').select('id, title').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('task_comments').select('id, comment, visibility, created_at').eq('company_id', auth.membership.companyId).eq('task_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('task_status_history').select('id, old_status, new_status, reason, created_at').eq('company_id', auth.membership.companyId).eq('task_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  if (!task) notFound()

  return (
    <AppShell auth={auth} title={task.title} subtitle="Uppdragsdetaljer, status, tilldelning, tidsfönster och kommentarer.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <FormCard title="Redigera uppdrag">
          <TaskForm action={updateTaskAction} task={task} taskTypes={taskTypes ?? []} entities={entities ?? []} teams={teams ?? []} staff={staff ?? []} workOrders={workOrders ?? []} submitLabel="Spara uppdrag" />
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
