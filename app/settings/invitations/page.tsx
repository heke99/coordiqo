export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { COMPANY_ROLE_LABELS, type CompanyRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { cancelInvitationAction, createInvitationAction, resendInvitationAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SettingsInvitationsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const { data: invitations } = await supabaseAdmin
    .from('company_invitations')
    .select('id, email, full_name, role, status, email_delivery_status, email_sent_at, last_email_error, resend_count, last_resent_at, expires_at, created_at')
    .eq('company_id', auth.membership.companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  const roles = Object.keys(COMPANY_ROLE_LABELS) as CompanyRole[]

  return (
    <AppShell auth={auth} title="Inbjudningar" subtitle="Bjud in användare via riktig email, skicka om aktiva invites och avbryt felaktiga inbjudningar.">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Ny inbjudan</h2>
          <form action={createInvitationAction} className="mt-4 space-y-3">
            <input name="email" type="email" required placeholder="namn@bolag.se" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="full_name" placeholder="Namn, valfritt" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select name="role" defaultValue="staff" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {roles.map((role) => <option key={role} value={role}>{COMPANY_ROLE_LABELS[role]}</option>)}
            </select>
            <textarea name="message" placeholder="Meddelande, valfritt" className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Skicka invite</button>
          </form>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Skickade inbjudningar</h2>
          <div className="mt-4 space-y-3">
            {(invitations ?? []).map((invite: any) => (
              <div key={invite.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{invite.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{invite.full_name ?? 'namn saknas'} · {COMPANY_ROLE_LABELS[invite.role as CompanyRole] ?? invite.role} · går ut {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString('sv-SE') : 'okänt'}</p>
                    {invite.last_email_error ? <p className="mt-2 text-xs text-red-600">{invite.last_email_error}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2"><StatusBadge status={invite.status} /><StatusBadge status={invite.email_delivery_status ?? 'email okänd'} /></div>
                </div>
                {invite.status === 'pending' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={resendInvitationAction}><input type="hidden" name="id" value={invite.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Skicka om</button></form>
                    <form action={cancelInvitationAction}><input type="hidden" name="id" value={invite.id} /><button className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Avbryt</button></form>
                  </div>
                ) : null}
              </div>
            ))}
            {!invitations?.length ? <p className="text-sm text-slate-600">Inga inbjudningar ännu.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
