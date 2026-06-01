export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { decideAiSuggestionAction } from '@/lib/engines/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AiDecisionRow = {
  id: string
  decision_type: string
  suggested_action: string | null
  validation_status: string
  decision_reason: string | null
  created_at: string
  ai_runs: { input_summary: string | null; output_summary: string | null; locale: string | null; status: string | null } | null
}

export default async function AiSuggestionsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { data } = await supabaseAdmin
    .from('ai_decision_logs')
    .select('id, decision_type, suggested_action, validation_status, decision_reason, created_at, ai_runs(input_summary, output_summary, locale, status)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(80)
  const rows = (data ?? []) as unknown as AiDecisionRow[]

  return (
    <AppShell auth={auth} title="AI-förslag" subtitle="Granska, godkänn eller avvisa AI-förslag innan de påverkar drift, kunder eller planering." actions={<Link href="/integrations" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">AI och integrationer</Link>}>
      <div className="space-y-4">
        {rows.length ? rows.map((row) => (
          <section key={row.id} className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{row.decision_type}</h2>
                <p className="mt-1 text-sm text-slate-500">{row.suggested_action ?? 'review'} · {new Date(row.created_at).toLocaleString('sv-SE')}</p>
              </div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={row.validation_status} /><StatusBadge status={row.ai_runs?.status ?? 'unknown'} /></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{row.ai_runs?.output_summary ?? row.ai_runs?.input_summary ?? 'AI-förslag saknar sammanfattning.'}</p>
            <form action={decideAiSuggestionAction} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[160px_1fr_auto]">
              <input type="hidden" name="id" value={row.id} />
              <Field label="Beslut"><select name="decision" defaultValue="approved" className={selectClassName}><option value="approved">Godkänn</option><option value="rejected">Avvisa</option><option value="ignored">Ignorera</option></select></Field>
              <Field label="Orsak"><input name="reason" defaultValue={row.decision_reason ?? ''} className={inputClassName} /></Field>
              <div className="flex items-end"><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara beslut</button></div>
            </form>
          </section>
        )) : (
          <section className="coordiqo-card p-6 text-sm text-slate-600">Inga AI-förslag väntar på beslut.</section>
        )}
      </div>
    </AppShell>
  )
}

