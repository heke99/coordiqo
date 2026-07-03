export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createBillingUnderlayAction } from '@/lib/engines/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type BillingUnderlayRow = {
  id: string
  period_start: string
  period_end: string
  status: string
  currency: string
  subtotal_amount: number
  total_amount: number
  created_at: string
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export default async function ReportsPage() {
  const auth = await requireCompanyContext()
  const companyId = auth.membership.companyId
  const today = new Date().toISOString().slice(0, 10)
  const periodStart = today.slice(0, 8) + '01'
  const [{ count: completedTasks }, { count: openDeviations }, { count: aiRuns }, { data: underlays }, { data: metrics }] = await Promise.all([
    supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed').is('archived_at', null),
    supabaseAdmin.from('deviations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['open', 'in_progress']).is('archived_at', null),
    supabaseAdmin.from('ai_runs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('billing_underlays').select('id, period_start, period_end, status, currency, subtotal_amount, total_amount, created_at').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('dashboard_metrics').select('metric_key, metric_date, numeric_value').eq('company_id', companyId).order('metric_date', { ascending: false }).limit(20),
  ])
  const billingRows = (underlays ?? []) as BillingUnderlayRow[]

  return (
    <AppShell
      auth={auth}
      title="Rapporter och faktureringsunderlag"
      subtitle="Affärsvärde, statistik, avvikelser, AI-användning och underlag för fakturering."
      actions={<Link href="/deviations" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Avvikelser</Link>}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Slutförda uppdrag</p><p className="mt-2 text-3xl font-semibold text-slate-950">{completedTasks ?? 0}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Öppna avvikelser</p><p className="mt-2 text-3xl font-semibold text-red-700">{openDeviations ?? 0}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">AI-beslutsstöd</p><p className="mt-2 text-3xl font-semibold text-slate-950">{aiRuns ?? 0}</p></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skapa faktureringsunderlag</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Summerar uppdrag i vald period med ett timpris. Underlaget kan granskas innan export.</p>
            <form action={createBillingUnderlayAction} className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Från"><input name="period_start" type="date" defaultValue={periodStart} required className={inputClassName} /></Field>
                <Field label="Till"><input name="period_end" type="date" defaultValue={today} required className={inputClassName} /></Field>
              </div>
              <Field label="Timpris"><input name="hourly_price" type="number" defaultValue="650" className={inputClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa underlag</button>
            </form>
          </div>

          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Senaste underlag</h2>
            <div className="mt-4 space-y-3">
              {billingRows.length ? billingRows.map((underlay) => (
                <div key={underlay.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">{underlay.period_start} – {underlay.period_end}</p>
                      <p className="mt-1 text-sm text-slate-500">Subtotal {money(underlay.subtotal_amount, underlay.currency)} · total {money(underlay.total_amount, underlay.currency)}</p>
                    </div>
                    <StatusBadge status={underlay.status} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga faktureringsunderlag ännu.</p>}
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Dashboard metrics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {(metrics ?? []).length ? metrics?.map((metric) => (
              <div key={`${metric.metric_key}-${metric.metric_date}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{metric.metric_key}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.numeric_value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.metric_date}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Metrics skapas när rapportjobb eller importer börjar mata data.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

