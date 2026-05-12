export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { createInboundEmailAction, createPropertyEmailChannelAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PropertyPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: entityTypes }, { data: entities }, { data: channels }, { data: emails }, { data: serviceRequests }] = await Promise.all([
    supabaseAdmin.from('entity_types').select('id, code, label_singular, label_plural').eq('company_id', auth.membership.companyId).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('entities').select('id, name, status, entity_types(code, label_singular)').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(12),
    supabaseAdmin.from('property_email_channels').select('*').eq('company_id', auth.membership.companyId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('inbound_emails').select('id, from_email, subject, status, matched_entity_id, service_request_id, created_at, entities(name)').eq('company_id', auth.membership.companyId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('service_requests').select('id, title, status, priority, reported_by_email, entity_id, created_at, entities(name)').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
  ])

  const propertyIdeas = [
    'Fastighetshierarki: fastighet → byggnad → våning → lägenhet/lokal → hyresgäst.',
    'Felanmälan via e-post, portal och telefon med automatisk matchning mot kontaktens e-post.',
    'Återkommande underhåll: ventilation, brand, hiss, filter, besiktningar och ronder.',
    'Leverantörer/entreprenörer kopplade till arbetsorder och SLA.',
    'Hyresgästportal med ärendestatus, dokument, bokningsbara tider och feedback.',
    'Nycklar, taggar, portkoder och accessinstruktioner på rätt behörighetsnivå.',
  ]

  return (
    <AppShell auth={auth} title="Fastighet & hyresvärd" subtitle="Branschvy för objekt, lägenheter, hyresgäster, felanmälan och arbetsorder.">
      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Objekttyper</p><p className="mt-2 text-3xl font-semibold text-slate-950">{entityTypes?.length ?? 0}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Senaste objekt</p><p className="mt-2 text-3xl font-semibold text-slate-950">{entities?.length ?? 0}</p></div>
            <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Felanmälningar</p><p className="mt-2 text-3xl font-semibold text-slate-950">{serviceRequests?.length ?? 0}</p></div>
          </section>

          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">Objektstruktur för hyresvärd</h2><Link href="/entities/new" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Nytt objekt</Link></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {entities?.length ? entities.map((entity: any) => (
                <Link key={entity.id} href={`/entities/${entity.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50">
                  <p className="font-semibold text-slate-950">{entity.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{entity.entity_types?.label_singular ?? 'Objekt'}</p>
                </Link>
              )) : <p className="text-sm text-slate-600">Skapa fastigheter, lägenheter, lokaler och hyresgäster från objektregistret.</p>}
            </div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Vad mer bör finnas för fastigheter?</h2>
            <div className="mt-4 grid gap-3">
              {propertyIdeas.map((idea) => <div key={idea} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">{idea}</div>)}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <FormCard title="Felanmälansmejl" description="Koppla en inbox/adress till felanmälan. Senare kan webhook/IMAP fylla inbound_emails automatiskt.">
            <form action={createPropertyEmailChannelAction} className="grid gap-4">
              <Field label="Visningsnamn"><input name="display_name" className={inputClassName} placeholder="Felanmälan" /></Field>
              <Field label="Inbound e-post"><input name="inbound_email" type="email" required className={inputClassName} placeholder="felanmalan@bolag.se" /></Field>
              <Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="paused">Pausad</option></select></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara kanal</button>
            </form>
            <div className="mt-4 space-y-2">{channels?.map((channel) => <div key={channel.id} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="font-semibold text-slate-950">{channel.display_name}</p><p className="text-sm text-slate-500">{channel.inbound_email}</p></div>)}</div>
          </FormCard>

          <FormCard title="Simulera inkommande felanmälan" description="För test: registrera ett mejl manuellt. Systemet matchar avsändarens e-post mot entity contacts och skapar service request.">
            <form action={createInboundEmailAction} className="grid gap-4">
              <Field label="Avsändare"><input name="from_email" type="email" required className={inputClassName} placeholder="hyresgast@email.se" /></Field>
              <Field label="Namn"><input name="from_name" className={inputClassName} placeholder="Hyresgäst" /></Field>
              <Field label="Prioritet"><select name="priority" defaultValue="normal" className={selectClassName}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="urgent">Akut</option></select></Field>
              <Field label="Ämne"><input name="subject" required className={inputClassName} placeholder="Vattenläcka i kök" /></Field>
              <Field label="Meddelande"><textarea name="body_text" className={textareaClassName} placeholder="Beskrivning från mejlet" /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa felanmälan från mejl</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Senaste inkommande mejl</h2>
            <div className="mt-4 space-y-3">{emails?.length ? emails.map((email: any) => <div key={email.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-950">{email.subject}</p><StatusBadge status={email.status} /></div><p className="mt-1 text-sm text-slate-500">{email.from_email} · {email.entities?.name ?? 'ingen matchning'}</p></div>) : <p className="text-sm text-slate-600">Inga inkommande mejl ännu.</p>}</div>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Senaste felanmälningar</h2>
            <div className="mt-4 space-y-3">{serviceRequests?.length ? serviceRequests.map((request: any) => <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-950">{request.title}</p><StatusBadge status={request.status} /></div><p className="mt-1 text-sm text-slate-500">{request.entities?.name ?? request.reported_by_email ?? 'saknar objekt'}</p></div>) : <p className="text-sm text-slate-600">Inga felanmälningar ännu.</p>}</div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
