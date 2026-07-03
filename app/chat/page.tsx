export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createChatChannelAction, createChatMessageAction } from '@/lib/engines/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ChatAutoRefresh } from './auto-refresh'

type ChannelRow = {
  id: string
  name: string
  description: string | null
  channel_type: string
  created_at: string
}

type MessageRow = {
  id: string
  chat_channel_id: string
  body: string
  importance: string
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default async function ChatPage() {
  const auth = await requireCompanyContext()
  const companyId = auth.membership.companyId
  const [{ data: channels }, { data: messages }] = await Promise.all([
    supabaseAdmin.from('chat_channels').select('id, name, description, channel_type, created_at').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(40),
    supabaseAdmin.from('chat_messages').select('id, chat_channel_id, body, importance, created_at, profiles(full_name, email)').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(80),
  ])
  const channelRows = (channels ?? []) as unknown as ChannelRow[]
  const messageRows = (messages ?? []) as unknown as MessageRow[]
  const activeChannel = channelRows[0] ?? null
  const activeMessages = activeChannel ? messageRows.filter((message) => message.chat_channel_id === activeChannel.id) : []

  return (
    <AppShell
      auth={auth}
      title="Command Center"
      subtitle="Intern chatt kopplad till operations, projekt, rutter, avvikelser och AI-beslutsstöd."
      actions={<Link href="/deviations" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Avvikelser</Link>}
    >
      <ChatAutoRefresh />
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Skapa kanal</h2>
            <form action={createChatChannelAction} className="mt-5 grid gap-4">
              <Field label="Namn"><input name="name" required className={inputClassName} /></Field>
              <Field label="Typ">
                <select name="channel_type" defaultValue="group" className={selectClassName}>
                  <option value="group">Grupp</option>
                  <option value="region">Region</option>
                  <option value="team">Team</option>
                  <option value="project">Projekt</option>
                  <option value="route">Rutt</option>
                  <option value="task">Uppdrag</option>
                </select>
              </Field>
              <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa kanal</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Kanaler</h2>
            <div className="mt-4 space-y-2">
              {channelRows.length ? channelRows.map((channel) => (
                <div key={channel.id} className={`rounded-2xl border p-4 ${channel.id === activeChannel?.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                  <p className="font-semibold text-slate-950">{channel.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{channel.description ?? channel.channel_type}</p>
                </div>
              )) : <p className="text-sm text-slate-600">Skapa första operationskanalen.</p>}
            </div>
          </section>
        </aside>

        <section className="coordiqo-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{activeChannel?.name ?? 'Ingen kanal'}</h2>
              <p className="mt-1 text-sm text-slate-500">{activeChannel?.description ?? 'Välj eller skapa en kanal för teamets kommunikation.'}</p>
            </div>
            {activeChannel ? <StatusBadge status={activeChannel.channel_type} /> : null}
          </div>

          {activeChannel ? (
            <form action={createChatMessageAction} className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_160px_auto]">
              <input type="hidden" name="chat_channel_id" value={activeChannel.id} />
              <input name="body" required placeholder="Skriv ett tydligt meddelande..." className={inputClassName} />
              <select name="importance" defaultValue="normal" className={selectClassName}>
                <option value="normal">Normal</option>
                <option value="important">Viktig</option>
              </select>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skicka</button>
            </form>
          ) : null}

          <div className="mt-6 space-y-3">
            {activeMessages.length ? activeMessages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{message.profiles?.full_name ?? message.profiles?.email ?? 'System'}</p>
                  <StatusBadge status={message.importance} tone={message.importance === 'important' ? 'warning' : 'neutral'} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{message.body}</p>
                <p className="mt-2 text-xs text-slate-400">{new Date(message.created_at).toLocaleString('sv-SE')}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Inga meddelanden i kanalen ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

