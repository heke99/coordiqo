export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getIndustryRegistry } from '@/lib/industry/registry'
import { resendInvitationAdminAction } from '@/lib/platform/admin-actions'
import { addDemoRequestNoteAction, createCompanyAdminFromDemoRequestAction, createCompanyFromDemoRequestAction, updateDemoRequestAction } from '@/lib/sales/demo-actions'
import { DEMO_STATUS_ORDER, demoNeedLabel, demoStatusLabel } from '@/lib/sales/demo-config'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminDemoRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin()
  const { id } = await params

  const [{ data: request }, { data: notes }, { data: admins }, registry] = await Promise.all([
    supabaseAdmin.from('demo_requests').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('demo_request_notes').select('id, note, created_by, created_at').eq('demo_request_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, email, full_name').in('platform_role', ['owner', 'platform_admin', 'support_admin']).order('email'),
    getIndustryRegistry(),
  ])
  if (!request) notFound()
  const adminRows = (admins ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>
  const noteRows = (notes ?? []) as Array<{ id: string; note: string; created_by: string | null; created_at: string }>
  const industryLabel = registry.find((profile) => profile.code === request.industry)?.nameSv ?? request.industry ?? 'bransch saknas'

  const [{ data: emails }, { data: invitations }] = await Promise.all([
    supabaseAdmin.from('outbound_emails').select('id, to_email, subject, status, created_at').eq('related_entity_type', 'demo_request').eq('related_entity_id', id).order('created_at', { ascending: false }).limit(10),
    request.created_company_id
      ? supabaseAdmin.from('company_invitations').select('id, email, status, email_delivery_status, created_at').eq('company_id', request.created_company_id).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <AppShell auth={auth} title={request.company_name} subtitle="Kvalificera lead, hantera säljstatus och starta kontrollerad onboarding." actions={<Link href="/admin/demo-requests" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Alla leads</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{request.company_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{request.organization_number ?? 'org.nr saknas'} · {industryLabel} · {request.source === 'website' ? 'webbplats' : request.source}</p>
              </div>
              <StatusBadge status={demoStatusLabel(request.status)} tone={request.status === 'won' ? 'success' : request.status === 'lost' ? 'danger' : 'neutral'} />
            </div>
            {request.lost_reason ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Förlorad: {request.lost_reason}</p> : null}
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Kontaktperson', request.contact_name],
                ['E-post', request.email],
                ['Telefon', request.phone ?? '—'],
                ['Antal anställda', request.employee_count ?? '—'],
                ['Uppdrag per vecka', request.weekly_jobs_count ?? '—'],
                ['Önskat språk', request.preferred_language === 'en' ? 'Engelska' : 'Svenska'],
                ['Behov', (request.needs ?? []).map((need: string) => demoNeedLabel(need)).join(', ') || '—'],
                ['Skapad', new Date(request.created_at).toLocaleString('sv-SE')],
              ].map(([label, val]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">{val}</dd>
                </div>
              ))}
            </dl>
            {request.message ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{request.message}</div> : null}
            {request.created_company_id ? (
              <Link href={`/admin/companies/${request.created_company_id}`} className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">Öppna kopplat bolag →</Link>
            ) : null}
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Interna noteringar</h2>
            <form action={addDemoRequestNoteAction} className="mt-4 grid gap-3">
              <input type="hidden" name="demo_request_id" value={request.id} />
              <textarea name="note" required className={textareaClassName} placeholder="Kvalificering, invändningar, nästa steg..." />
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till notering</button>
            </form>
            <div className="mt-5 space-y-3">
              {noteRows.length ? noteRows.map((note) => (
                <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm leading-6 text-slate-700">{note.note}</p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(note.created_at).toLocaleString('sv-SE')}</p>
                </div>
              )) : <p className="text-sm text-slate-600">Inga noteringar ännu.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">E-posthistorik</h2>
            <div className="mt-4 space-y-2">
              {emails?.length ? emails.map((email: any) => (
                <div key={email.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{email.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{email.to_email} · {new Date(email.created_at).toLocaleString('sv-SE')}</p>
                  </div>
                  <StatusBadge status={email.status === 'sent' ? 'Skickat' : email.status === 'failed' ? 'Misslyckades' : 'Köad'} tone={email.status === 'sent' ? 'success' : email.status === 'failed' ? 'danger' : 'warning'} />
                </div>
              )) : <p className="text-sm text-slate-600">Inga e-postutskick kopplade till denna lead.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Leadstatus</h2>
            <form action={updateDemoRequestAction} className="mt-4 grid gap-4">
              <input type="hidden" name="id" value={request.id} />
              <Field label="Status">
                <select name="status" defaultValue={request.status} className={selectClassName}>
                  {DEMO_STATUS_ORDER.map((status) => <option key={status} value={status}>{demoStatusLabel(status)}</option>)}
                </select>
              </Field>
              <Field label="Ansvarig">
                <select name="assigned_to" defaultValue={request.assigned_to ?? ''} className={selectClassName}>
                  <option value="">Ingen ansvarig</option>
                  {adminRows.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name ?? admin.email ?? admin.id}</option>)}
                </select>
              </Field>
              <Field label="Nästa kontakt"><input name="next_contact_at" type="datetime-local" defaultValue={request.next_contact_at ? request.next_contact_at.slice(0, 16) : ''} className={inputClassName} /></Field>
              <Field label="Orsak vid förlorad" hint="Krävs om status sätts till Förlorad."><input name="lost_reason" defaultValue={request.lost_reason ?? ''} className={inputClassName} placeholder="Ex. valde annan leverantör, fel tajming" /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara lead</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skapa bolag</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Skapar företagsmiljö från denna kvalificerade lead med branschens standardinnehåll, onboarding och första team. Allt går att ändra senare.</p>
            <form action={createCompanyFromDemoRequestAction} className="mt-4">
              <input type="hidden" name="demo_request_id" value={request.id} />
              <button disabled={Boolean(request.created_company_id)} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {request.created_company_id ? 'Bolag är redan skapat' : 'Skapa bolag från ansökan'}
              </button>
            </form>
          </section>

          {request.created_company_id ? (
            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Skapa första administratör</h2>
              <form action={createCompanyAdminFromDemoRequestAction} className="mt-4 grid gap-4">
                <input type="hidden" name="demo_request_id" value={request.id} />
                <input type="hidden" name="company_id" value={request.created_company_id} />
                <Field label="Namn"><input name="full_name" defaultValue={request.contact_name} required className={inputClassName} /></Field>
                <Field label="E-post"><input name="email" type="email" defaultValue={request.email} required className={inputClassName} /></Field>
                <Field label="Tillfälligt lösenord" hint="Minst 12 tecken med stor bokstav, liten bokstav och siffra."><input name="temporary_password" type="password" required className={inputClassName} /></Field>
                <Field label="Språk"><select name="preferred_language" defaultValue={request.preferred_language} className={selectClassName}><option value="sv">Svenska</option><option value="en">Engelska</option></select></Field>
                <Field label="Roll"><select name="role" defaultValue="company_admin" className={selectClassName}><option value="company_admin">Företagsadministratör</option><option value="operations_manager">Driftansvarig</option></select></Field>
                <button className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Skapa administratör</button>
              </form>
              {invitations?.length ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-950">Inbjudningar</p>
                  <div className="mt-2 space-y-2">
                    {invitations.map((invite: any) => (
                      <div key={invite.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-950">{invite.email}</p>
                          <p className="text-xs text-slate-500">{invite.status} · {invite.email_delivery_status ?? 'okänd leveransstatus'}</p>
                        </div>
                        {invite.status === 'pending' ? (
                          <form action={resendInvitationAdminAction}>
                            <input type="hidden" name="invitation_id" value={invite.id} />
                            <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Skicka igen</button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  )
}
