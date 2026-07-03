export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { getSupportEmail } from '@/lib/config/emails'
import { createSupportSessionAction, endSupportSessionAction } from '@/lib/platform/actions'
import { createSupportRequestAction } from '@/lib/support/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const REQUEST_STATUS_LABELS: Record<string, string> = {
  new: 'Ny',
  in_progress: 'Pågår',
  waiting_for_customer: 'Väntar på er',
  resolved: 'Löst',
  archived: 'Arkiverad',
}

export default async function SettingsSupportPage() {
  const auth = await requireCompanyContext()
  const supportEmail = getSupportEmail()

  const [{ data: memberships }, { data: sessions }, { data: supportRequests }] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('id, user_id, role, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('support_sessions').select('id, reason, status, started_at, ended_at, target_membership_id').eq('company_id', auth.membership.companyId).order('started_at', { ascending: false }).limit(20),
    supabaseAdmin.from('support_requests').select('id, subject, message, severity, status, created_at').eq('company_id', auth.membership.companyId).order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <AppShell auth={auth} title="Support" subtitle="Skapa supportärenden, se status och hantera supportsessioner för felsökning.">
      <div className="space-y-5">
        <section className="coordiqo-card p-5">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Kontakta supporten</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Beskriv vad du behöver hjälp med så återkommer vi. Ta gärna med:
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                <li>• Vad du försökte göra och vad som hände</li>
                <li>• Vilken sida det gäller (adressen i webbläsaren)</li>
                <li>• Om fler användare påverkas</li>
              </ul>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-900">E-post:</span> <a href={`mailto:${supportEmail}`} className="underline underline-offset-2">{supportEmail}</a></p>
                <p className="mt-1"><span className="font-semibold text-slate-900">Er referens:</span> {auth.membership.companyName}</p>
                <p className="mt-1"><span className="font-semibold text-slate-900">Miljö:</span> {auth.membership.industryLabel} · {auth.membership.operationalModelLabel}</p>
              </div>
              <Link href="/settings/health" className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline-offset-4 hover:underline">Se systemstatus →</Link>
            </div>

            <form action={createSupportRequestAction} className="grid gap-3">
              <label className="text-sm font-medium text-slate-700">Ämne
                <input name="subject" required maxLength={200} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Kort beskrivning av problemet" />
              </label>
              <label className="text-sm font-medium text-slate-700">Allvarlighetsgrad
                <select name="severity" defaultValue="normal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="low">Låg — fråga eller önskemål</option>
                  <option value="normal">Normal — något fungerar inte som väntat</option>
                  <option value="high">Hög — påverkar dagligt arbete</option>
                  <option value="critical">Kritisk — verksamheten står still</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Relaterad sida (frivilligt)
                <input name="related_url" maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="/planering" />
              </label>
              <label className="text-sm font-medium text-slate-700">Beskrivning
                <textarea name="message" required maxLength={4000} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Beskriv vad som hände och vad du förväntade dig." />
              </label>
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skicka supportärende</button>
            </form>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Era supportärenden</h2>
          <div className="mt-4 space-y-3">
            {supportRequests?.length ? supportRequests.map((request: any) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{request.subject}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{request.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(request.created_at).toLocaleString('sv-SE')}</p>
                  </div>
                  <StatusBadge status={REQUEST_STATUS_LABELS[request.status] ?? request.status} tone={request.status === 'resolved' ? 'success' : request.status === 'new' ? 'warning' : 'neutral'} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-600">Inga supportärenden ännu. Skapa det första ovan när du behöver hjälp.</p>}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Supportsessioner</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tidsbegränsad supportåtkomst för felsökning. Alla starter och avslut loggas.</p>
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
            <h2 className="text-lg font-semibold text-slate-950">Sessionshistorik</h2>
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
      </div>
    </AppShell>
  )
}
