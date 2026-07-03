export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminPage() {
  const auth = await requirePlatformAdmin()

  const [companiesRes, membershipsRes, requestsRes, invitesRes, auditRes, notificationsRes] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name, status, lifecycle_status, industry_type, operational_model, created_at').order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('company_memberships').select('id, status, role').is('archived_at', null).limit(10000),
    supabaseAdmin.from('company_access_requests').select('id, status, company_name, requested_role, created_at').order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('company_invitations').select('id, status, email_delivery_status').limit(10000),
    supabaseAdmin.from('audit_logs').select('id, action, entity_type, created_at, companies(name)').order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('notifications').select('id, status').limit(10000),
  ])

  const companies = companiesRes.data ?? []
  const memberships = membershipsRes.data ?? []
  const requests = requestsRes.data ?? []
  const invites = invitesRes.data ?? []
  const notifications = notificationsRes.data ?? []
  const audits = auditRes.data ?? []

  const activeCompanies = companies.filter((company: any) => company.status === 'active' && (company.lifecycle_status ?? 'active') === 'active').length
  const pendingRequests = requests.filter((request: any) => request.status === 'pending').length
  const unreadNotifications = notifications.filter((notification: any) => notification.status === 'unread').length
  const failedInvites = invites.filter((invite: any) => invite.email_delivery_status === 'failed').length

  const cards = [
    { label: 'Bolag', value: String(companies.length), href: '/admin/companies' },
    { label: 'Aktiva bolag', value: String(activeCompanies), href: '/admin/companies' },
    { label: 'Medlemskap', value: String(memberships.length), href: '/admin/companies' },
    { label: 'Väntande ansökningar', value: String(pendingRequests), href: '/admin/access-requests' },
    { label: 'Misslyckade invites', value: String(failedInvites), href: '/settings/invitations' },
    { label: 'Olästa notiser', value: String(unreadNotifications), href: '/notifications' },
  ]

  const adminLinks = [
    { label: 'Demoansökningar och leads', href: '/admin/demo-requests' },
    { label: 'Branscher', href: '/admin/industries' },
    { label: 'Supportärenden', href: '/admin/support' },
    { label: 'Go-live-kontroll', href: '/admin/go-live' },
    { label: 'Plattformshälsa', href: '/admin/health' },
    { label: 'Integrationer', href: '/admin/integrations' },
    { label: 'Plattformsaudit', href: '/admin/audit' },
  ]

  return (
    <AppShell auth={auth} title="Superadmin" subtitle="Plattformsöversikt för bolag, ansökningar, behörighet, audit och driftstatus.">
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</p>
            </Link>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Kontrollcenter</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Senaste bolag</h2>
              <Link href="/admin/companies" className="text-sm font-semibold text-slate-950">Alla bolag →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {companies.map((company: any) => (
                <Link key={company.id} href={`/admin/companies/${company.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{company.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{company.industry_type ?? 'bransch saknas'} · {company.operational_model ?? 'modell saknas'}</p>
                    </div>
                    <div className="flex gap-2"><StatusBadge status={company.lifecycle_status ?? company.status} /><StatusBadge status={company.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="coordiqo-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Ansökningar</h2>
              <Link href="/admin/access-requests" className="text-sm font-semibold text-slate-950">Granska →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {requests.length ? requests.map((request: any) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{request.company_name ?? 'Bolagsansökan'}</p>
                      <p className="mt-1 text-xs text-slate-500">Önskad roll: {request.requested_role ?? 'company_admin'}</p>
                    </div>
                    <StatusBadge status={request.status} tone={request.status === 'pending' ? 'warning' : 'neutral'} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-600">Inga ansökningar att visa.</p>}
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Senaste audit</h2>
            <Link href="/audit" className="text-sm font-semibold text-slate-950">Öppna auditlogg →</Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {audits.length ? audits.map((event: any) => (
              <div key={event.id} className="py-3 text-sm">
                <p className="font-semibold text-slate-950">{event.action} · {event.entity_type}</p>
                <p className="mt-1 text-xs text-slate-500">{event.companies?.name ?? 'Plattform'} · {new Date(event.created_at).toLocaleString('sv-SE')}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Ingen auditlogg ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
