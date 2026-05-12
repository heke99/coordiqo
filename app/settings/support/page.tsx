export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { createSupportSessionAction, endSupportSessionAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SupportPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: memberships }, { data: sessions }] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('id, role, profiles(full_name, email)').eq('company_id', auth.membership.companyId).eq('status', 'active'),
    supabaseAdmin.from('support_sessions').select('id, reason, status, started_at, expires_at, target_membership_id, profiles(full_name, email)').eq('company_id', auth.membership.companyId).order('started_at', { ascending: false }).limit(50),
  ])

  return (
    <AppShell auth={auth} title="Supportläge" subtitle="Spårbart supportläge och framtida view-as/impersonation, utan att dölja vem som gjort vad.">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <FormCard title="Starta supportsession" description="Alla supportsessioner loggas i audit. Detta är grund för säkert supportläge och view-as längre fram.">
          <form action={createSupportSessionAction} className="grid gap-4">
            <Field label="Valfri målmedlem"><select name="target_membership_id" className={selectClassName}><option value="">Ingen specifik användare</option>{memberships?.map((m: any) => <option key={m.id} value={m.id}>{m.profiles?.full_name ?? m.profiles?.email ?? m.role} · {m.role}</option>)}</select></Field>
            <Field label="Anledning"><textarea name="reason" required className={textareaClassName} placeholder="Ex. Kund bad support felsöka onboarding/behörighet." /></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Starta supportsession</button>
          </form>
        </FormCard>

        <section className="coordiqo-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Supporthistorik</h2>
          <div className="mt-5 space-y-3">
            {sessions?.length ? sessions.map((session: any) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{session.profiles?.full_name ?? session.profiles?.email ?? 'Support'}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{session.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">Startad {new Date(session.started_at).toLocaleString('sv-SE')} · löper till {new Date(session.expires_at).toLocaleString('sv-SE')}</p>
                  </div>
                  <StatusBadge status={session.status} />
                </div>
                {session.status === 'active' ? <form action={endSupportSessionAction} className="mt-3"><input type="hidden" name="id" value={session.id} /><button className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Avsluta session</button></form> : null}
              </div>
            )) : <p className="text-sm text-slate-600">Inga supportsessioner ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
