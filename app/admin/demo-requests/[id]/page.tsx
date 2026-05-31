export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { addDemoRequestNoteAction, createCompanyAdminFromDemoRequestAction, createCompanyFromDemoRequestAction, updateDemoRequestAction } from '@/lib/sales/demo-actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const statuses = ['new', 'contacted', 'demo_booked', 'offer_sent', 'won', 'lost', 'onboarding_started']

export default async function AdminDemoRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!isPlatformAdminRole(auth.platformRole)) redirect('/dashboard')
  const { id } = await params

  const [{ data: request }, { data: notes }, { data: admins }] = await Promise.all([
    supabaseAdmin.from('demo_requests').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('demo_request_notes').select('id, note, created_by, created_at').eq('demo_request_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, email, full_name').in('platform_role', ['owner', 'platform_admin', 'support_admin']).order('email'),
  ])
  if (!request) notFound()
  const adminRows = (admins ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>
  const noteRows = (notes ?? []) as Array<{ id: string; note: string; created_by: string | null; created_at: string }>

  return (
    <AppShell auth={auth} title={request.company_name} subtitle="Qualify lead, manage sales status and start controlled onboarding." actions={<Link href="/admin/demo-requests" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">All leads</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{request.company_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{request.organization_number ?? 'org number missing'} · {request.industry ?? 'industry missing'} · {request.source}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Contact person', request.contact_name],
                ['Email', request.email],
                ['Phone', request.phone ?? '-'],
                ['Employees', request.employee_count ?? '-'],
                ['Weekly jobs', request.weekly_jobs_count ?? '-'],
                ['Preferred language', request.preferred_language],
                ['Needs', request.needs?.join(', ') || '-'],
                ['Created', new Date(request.created_at).toLocaleString('sv-SE')],
                ['Linked company', request.created_company_id ?? '-'],
              ].map(([label, val]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">{val}</dd>
                </div>
              ))}
            </dl>
            {request.message ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{request.message}</div> : null}
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Internal notes</h2>
            <form action={addDemoRequestNoteAction} className="mt-4 grid gap-3">
              <input type="hidden" name="demo_request_id" value={request.id} />
              <textarea name="note" required className={textareaClassName} placeholder="Add qualification note, objections, next steps..." />
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Add note</button>
            </form>
            <div className="mt-5 space-y-3">
              {noteRows.length ? noteRows.map((note) => (
                <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm leading-6 text-slate-700">{note.note}</p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(note.created_at).toLocaleString('sv-SE')}</p>
                </div>
              )) : <p className="text-sm text-slate-600">No notes yet.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Lead status</h2>
            <form action={updateDemoRequestAction} className="mt-4 grid gap-4">
              <input type="hidden" name="id" value={request.id} />
              <Field label="Status">
                <select name="status" defaultValue={request.status} className={selectClassName}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Assigned admin">
                <select name="assigned_to" defaultValue={request.assigned_to ?? ''} className={selectClassName}>
                  <option value="">Unassigned</option>
                  {adminRows.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name ?? admin.email ?? admin.id}</option>)}
                </select>
              </Field>
              <Field label="Next contact date"><input name="next_contact_at" type="datetime-local" defaultValue={request.next_contact_at ? request.next_contact_at.slice(0, 16) : ''} className={inputClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Save lead</button>
            </form>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {['contacted', 'demo_booked', 'offer_sent', 'won', 'lost'].map((status) => (
                <form key={status} action={updateDemoRequestAction}>
                  <input type="hidden" name="id" value={request.id} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="assigned_to" value={request.assigned_to ?? ''} />
                  <button className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Mark {status}</button>
                </form>
              ))}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Create company</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Creates a company workspace from this qualified lead. Industry model only prepares editable defaults and never locks the system.</p>
            <form action={createCompanyFromDemoRequestAction} className="mt-4">
              <input type="hidden" name="demo_request_id" value={request.id} />
              <button disabled={Boolean(request.created_company_id)} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {request.created_company_id ? 'Company already created' : 'Create company from request'}
              </button>
            </form>
          </section>

          {request.created_company_id ? (
            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Create company admin</h2>
              <form action={createCompanyAdminFromDemoRequestAction} className="mt-4 grid gap-4">
                <input type="hidden" name="demo_request_id" value={request.id} />
                <input type="hidden" name="company_id" value={request.created_company_id} />
                <Field label="Full name"><input name="full_name" defaultValue={request.contact_name} required className={inputClassName} /></Field>
                <Field label="Email"><input name="email" type="email" defaultValue={request.email} required className={inputClassName} /></Field>
                <Field label="Temporary password"><input name="temporary_password" type="password" required className={inputClassName} /></Field>
                <Field label="Language"><select name="preferred_language" defaultValue={request.preferred_language} className={selectClassName}><option value="sv">Swedish</option><option value="en">English</option></select></Field>
                <Field label="Role"><select name="role" defaultValue="company_admin" className={selectClassName}><option value="company_admin">Company admin</option><option value="operations_manager">Admin / operations manager</option></select></Field>
                <button className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Create admin with temporary password</button>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  )
}

