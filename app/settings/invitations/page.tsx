export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageInvitations } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { cancelInvitationAction, createInvitationAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const roles = [
  ['operations_manager', 'Driftansvarig'],
  ['planner', 'Planerare'],
  ['supervisor', 'Supervisor'],
  ['dispatcher', 'Dispatcher'],
  ['team_lead', 'Teamledare'],
  ['staff', 'Personal'],
  ['contractor', 'Extern utförare'],
  ['read_only', 'Endast läsning'],
]

export default async function InvitationsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const canManage = canManageInvitations(auth.membership.companyRole)

  const { data: invitations, error } = await supabaseAdmin
    .from('company_invitations')
    .select('id, email, full_name, role, status, message, token, email_delivery_status, email_sent_at, last_email_error, expires_at, created_at')
    .eq('company_id', auth.membership.companyId)
    .order('created_at', { ascending: false })

  return (
    <AppShell auth={auth} title="Inbjudningar" subtitle="Bjud in användare utan att skapa medlemskap innan auth-kontot finns.">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <FormCard title="Ny inbjudan" description="Skapar invite, köar e-post och skickar automatiskt om RESEND_API_KEY är satt. Utan provider visas länken och mejlet ligger i outbound-kön.">
          {canManage ? (
            <form action={createInvitationAction} className="grid gap-4">
              <Field label="E-post"><input name="email" type="email" required className={inputClassName} placeholder="namn@bolag.se" /></Field>
              <Field label="Namn"><input name="full_name" className={inputClassName} placeholder="Frivilligt" /></Field>
              <Field label="Roll"><select name="role" defaultValue="staff" className={selectClassName}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Meddelande"><textarea name="message" className={textareaClassName} placeholder="Intern kommentar eller instruktion" /></Field>
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa inbjudan</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">Du saknar behörighet för att skapa inbjudningar.</p>
          )}
        </FormCard>

        <section className="coordiqo-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Aktuella inbjudningar</h2>
          {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
          <div className="mt-5 space-y-3">
            {invitations?.length ? invitations.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{invite.full_name ?? invite.email}</p>
                    <p className="mt-1 text-sm text-slate-500">{invite.email} · {invite.role}</p>
                    <p className="mt-1 text-xs text-slate-400">Gäller till {new Date(invite.expires_at).toLocaleDateString('sv-SE')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2"><StatusBadge status={invite.status} /><StatusBadge status={invite.email_delivery_status ?? 'queued'} /></div>
                </div>
                {invite.message ? <p className="mt-3 text-sm leading-6 text-slate-600">{invite.message}</p> : null}
                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Accept-länk</p>
                  <p className="mt-1 break-all">{`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/invite/accept?token=${invite.token}`}</p>
                  {invite.last_email_error ? <p className="mt-2 text-red-600">{invite.last_email_error}</p> : null}
                </div>
                {canManage && invite.status === 'pending' ? (
                  <form action={cancelInvitationAction} className="mt-3">
                    <input type="hidden" name="id" value={invite.id} />
                    <button className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Avbryt invite</button>
                  </form>
                ) : null}
              </div>
            )) : <p className="text-sm text-slate-600">Inga inbjudningar ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
