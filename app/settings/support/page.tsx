export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { createSupportSessionAction, endSupportSessionAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SettingsSupportPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: memberships }, { data: sessions }] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('id, user_id, role, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('support_sessions').select('id, reason, status, started_at, ended_at, target_membership_id').eq('company_id', auth.membership.companyId).order('started_at', { ascending: false }).limit(50),
  ])

  return (
    <AppShell auth={auth} title="Supportläge" subtitle="Tidsbegränsad och audit-loggad supportåtkomst för felsökning och hjälp till användare.">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Starta supportsession</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Supportläge ska alltid ha en tydlig orsak. Alla starter och avslut loggas i audit.</p>
          <form action={createSupportSessionAction} className="mt-4 space-y-3">
            <select name="target_membership_id" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Allmänt bolagsstöd</option>
              {(memberships ?? []).map((membership: any) => <option key={membership.id} value={membership.id}>{membership.user_id} · {membership.role}</option>)}
            </select>
            <textarea name="reason" required placeholder="Varför behövs supportläge?" className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Starta supportsession</button>
          </form>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Supporthistorik</h2>
          <div className="mt-4 space-y-3">
            {(sessions ?? []).map((session: any) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{session.target_membership_id ?? 'Bolagssupport'}</p>
                    <p className="mt-1 text-sm text-slate-600">{session.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">Startad {new Date(session.started_at).toLocaleString('sv-SE')}{session.ended_at ? ` · avslutad ${new Date(session.ended_at).toLocaleString('sv-SE')}` : ''}</p>
                  </div>
                  <StatusBadge status={session.status} tone={session.status === 'active' ? 'warning' : 'neutral'} />
                </div>
                {session.status === 'active' ? (
                  <form action={endSupportSessionAction} className="mt-3"><input type="hidden" name="id" value={session.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Avsluta session</button></form>
                ) : null}
              </div>
            ))}
            {!sessions?.length ? <p className="text-sm text-slate-600">Inga supportsessioner ännu.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
