export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createDeviationAction, updateDeviationStatusAction } from '@/lib/engines/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DeviationRow = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  customer_impact: boolean
  route_impact: boolean
  billing_impact: boolean
  sla_risk: boolean
  created_at: string
  tasks: { title: string } | null
  projects: { name: string } | null
}

export default async function DeviationsPage() {
  const auth = await requireCompanyContext()
  const companyId = auth.membership.companyId
  const [{ data: deviations }, { data: tasks }, { data: projects }] = await Promise.all([
    supabaseAdmin.from('deviations').select('id, title, description, status, priority, customer_impact, route_impact, billing_impact, sla_risk, created_at, tasks(title), projects(name)').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(80),
    supabaseAdmin.from('tasks').select('id, title').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('projects').select('id, name').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
  ])
  const rows = (deviations ?? []) as unknown as DeviationRow[]

  return (
    <AppShell
      auth={auth}
      title="Avvikelser"
      subtitle="Rapportera, prioritera, följ upp och stäng avvikelser med audit och koppling till uppdrag, projekt och fakturering."
      actions={<Link href="/reports" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Rapporter</Link>}
    >
      <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Ny avvikelse</h2>
          <form action={createDeviationAction} className="mt-5 grid gap-4">
            <Field label="Rubrik"><input name="title" required className={inputClassName} /></Field>
            <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
            <Field label="Prioritet">
              <select name="priority" defaultValue="normal" className={selectClassName}>
                <option value="low">Låg</option>
                <option value="normal">Normal</option>
                <option value="high">Hög</option>
                <option value="urgent">Akut</option>
              </select>
            </Field>
            <Field label="Koppla till uppdrag">
              <select name="task_id" defaultValue="" className={selectClassName}>
                <option value="">Ingen koppling</option>
                {(tasks ?? []).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </Field>
            <Field label="Koppla till projekt">
              <select name="project_id" defaultValue="" className={selectClassName}>
                <option value="">Ingen koppling</option>
                {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </Field>
            <div className="grid gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" name="customer_impact" /> Kundpåverkan</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="route_impact" /> Ruttpåverkan</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="billing_impact" /> Faktureringspåverkan</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="sla_risk" /> SLA-risk</label>
            </div>
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Rapportera avvikelse</button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Öppna</p><p className="mt-2 text-3xl font-semibold text-slate-950">{rows.filter((row) => row.status === 'open').length}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">SLA-risk</p><p className="mt-2 text-3xl font-semibold text-red-700">{rows.filter((row) => row.sla_risk).length}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Kundpåverkan</p><p className="mt-2 text-3xl font-semibold text-slate-950">{rows.filter((row) => row.customer_impact).length}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Fakturering</p><p className="mt-2 text-3xl font-semibold text-slate-950">{rows.filter((row) => row.billing_impact).length}</p></div>
          </div>

          {rows.map((deviation) => (
            <section key={deviation.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{deviation.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{deviation.tasks?.title ?? deviation.projects?.name ?? 'Ingen koppling'} · {new Date(deviation.created_at).toLocaleString('sv-SE')}</p>
                  {deviation.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{deviation.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={deviation.status} /><StatusBadge status={deviation.priority} tone={deviation.priority === 'urgent' || deviation.priority === 'high' ? 'danger' : 'neutral'} /></div>
              </div>
              <form action={updateDeviationStatusAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[180px_1fr_auto]">
                <input type="hidden" name="id" value={deviation.id} />
                <select name="status" defaultValue={deviation.status} className={selectClassName}>
                  <option value="open">Öppen</option>
                  <option value="in_progress">Pågår</option>
                  <option value="resolved">Löst</option>
                  <option value="closed">Stängd</option>
                </select>
                <input name="resolution" placeholder="Åtgärd eller kommentar" className={inputClassName} />
                <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara</button>
              </form>
            </section>
          ))}
        </section>
      </div>
    </AppShell>
  )
}

