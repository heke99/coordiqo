export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createExternalSmsMessageAction } from '@/lib/engines/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ExternalMessageRow = {
  id: string
  to_address: string | null
  body: string
  status: string
  created_at: string
  message_threads: { subject: string | null; customer_label: string | null } | null
}

export default async function MessagesPage() {
  const auth = await requireCompanyContext()
  const { data: messages } = await supabaseAdmin
    .from('external_messages')
    .select('id, to_address, body, status, created_at, message_threads(subject, customer_label)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (messages ?? []) as unknown as ExternalMessageRow[]

  return (
    <AppShell auth={auth} title="Kundmeddelanden" subtitle="Skicka och följ upp SMS kopplade till drift, avvikelser och kundinformation." actions={<Link href="/reports" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Rapporter</Link>}>
      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Skicka SMS</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Meddelandet sparas alltid. Om SMS-tjänsten inte är konfigurerad läggs det i kö för manuell hantering.</p>
          <form action={createExternalSmsMessageAction} className="mt-5 grid gap-4">
            <Field label="Ämne"><input name="subject" className={inputClassName} /></Field>
            <Field label="Telefonnummer"><input name="to" required className={inputClassName} placeholder="+46701234567" /></Field>
            <Field label="Meddelande"><textarea name="body" required className={textareaClassName} /></Field>
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skicka eller köa</button>
          </form>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Senaste meddelanden</h2>
          <div className="mt-4 space-y-3">
            {rows.length ? rows.map((message) => (
              <div key={message.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{message.message_threads?.subject ?? message.to_address ?? 'Kundmeddelande'}</p>
                    <p className="mt-1 text-xs text-slate-500">{message.to_address ?? message.message_threads?.customer_label ?? '-'} · {new Date(message.created_at).toLocaleString('sv-SE')}</p>
                  </div>
                  <StatusBadge status={message.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{message.body}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Inga kundmeddelanden ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

