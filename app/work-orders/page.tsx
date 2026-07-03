export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createWorkOrderAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function WorkOrdersPage() {
  const auth = await requireCompanyContext()

  const [{ data: workOrders }, { data: entities }] = await Promise.all([
    supabaseAdmin.from('work_orders').select('id, title, status, priority, due_at, entities(name), created_at').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('entities').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(200),
  ])

  return (
    <AppShell auth={auth} title="Arbetsorder" subtitle="Samla uppdrag och ärenden i arbetsorder innan planeringsmotorn byggs.">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <FormCard title="Ny arbetsorder" description="Arbetsorder kan senare bära flera uppdrag, SLA, ärendehistorik och extern portalstatus.">
          <form action={createWorkOrderAction} className="grid gap-4">
            <Field label="Titel"><input name="title" required className={inputClassName} /></Field>
            <Field label="Objekt"><select name="entity_id" className={selectClassName}><option value="">Inget objekt</option>{entities?.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status"><select name="status" defaultValue="open" className={selectClassName}><option value="draft">Utkast</option><option value="open">Öppen</option><option value="scheduled">Schemalagd</option><option value="in_progress">Pågår</option><option value="completed">Klar</option><option value="cancelled">Avbruten</option></select></Field>
              <Field label="Prioritet"><select name="priority" defaultValue="normal" className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
            </div>
            <Field label="Deadline"><input name="due_at" type="datetime-local" className={inputClassName} /></Field>
            <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa arbetsorder</button>
          </form>
        </FormCard>

        <section className="coordiqo-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Aktiva arbetsorder</h2>
          <div className="mt-5 space-y-3">
            {workOrders?.length ? workOrders.map((order: any) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{order.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{order.entities?.name ?? 'Inget objekt'}{order.due_at ? ` · deadline ${new Date(order.due_at).toLocaleString('sv-SE')}` : ''}</p>
                  </div>
                  <div className="flex gap-2"><StatusBadge status={order.priority} /><StatusBadge status={order.status} /></div>
                </div>
                <Link href={`/tasks/new?work_order_id=${order.id}`} className="mt-3 inline-flex rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Skapa uppdrag från order</Link>
              </div>
            )) : <p className="text-sm text-slate-600">Inga arbetsorder ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
