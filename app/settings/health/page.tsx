export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function countRows(table: string, companyId: string) {
  const { count } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  return count ?? 0
}

export default async function SettingsHealthPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const companyId = auth.membership.companyId

  const [members, presets, taskTypes, resourceTypes, resources, shifts, invites, permissions, audits, notifications] = await Promise.all([
    countRows('company_memberships', companyId),
    countRows('shift_presets', companyId),
    countRows('task_types', companyId),
    countRows('resource_types', companyId),
    countRows('resources', companyId),
    countRows('shifts', companyId),
    countRows('company_invitations', companyId),
    countRows('company_role_permissions', companyId),
    countRows('audit_logs', companyId),
    countRows('notifications', companyId),
  ])

  const checks = [
    { label: 'Bransch vald', ok: Boolean(auth.membership.industryType), href: '/settings/industry', detail: auth.membership.industryLabel },
    { label: 'Operativ modell vald', ok: Boolean(auth.membership.operationalModel), href: '/settings/industry', detail: auth.membership.operationalModelLabel },
    { label: 'Aktiva moduler finns', ok: auth.membership.activeModules.length > 0, href: '/settings/industry', detail: `${auth.membership.activeModules.length} moduler` },
    { label: 'Minst en aktiv användare', ok: members > 0, href: '/admin/companies', detail: `${members} medlemskap` },
    { label: 'Passpresets finns', ok: presets > 0, href: '/availability/presets', detail: `${presets} presets` },
    { label: 'Uppdragstyper finns', ok: taskTypes > 0, href: '/tasks', detail: `${taskTypes} typer` },
    { label: 'Resurstyper finns', ok: resourceTypes > 0, href: '/resources', detail: `${resourceTypes} typer` },
    { label: 'Resurser upplagda', ok: resources > 0, href: '/resources', detail: `${resources} resurser` },
    { label: 'Schema/pass finns', ok: shifts > 0, href: '/schedule', detail: `${shifts} pass` },
    { label: 'Invite-flow används', ok: invites > 0, href: '/settings/invitations', detail: `${invites} invites` },
    { label: 'Permission overrides granskade', ok: permissions > 0, href: '/settings/permissions', detail: `${permissions} overrides` },
    { label: 'Auditlogg aktiv', ok: audits > 0, href: '/audit', detail: `${audits} händelser` },
    { label: 'Notiscenter aktivt', ok: notifications >= 0, href: '/notifications', detail: `${notifications} notiser` },
    { label: 'Email provider konfigurerad', ok: Boolean(process.env.RESEND_API_KEY), href: '/settings/invitations', detail: process.env.RESEND_API_KEY ? 'Resend finns' : 'RESEND_API_KEY saknas' },
    { label: 'Storage bucket namn finns', ok: Boolean(process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents'), href: '/settings', detail: process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents' },
    { label: 'Maps provider', ok: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), href: '/operations/today', detail: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Google Maps finns' : 'Maps API saknas' },
    { label: 'Langflow/AI provider', ok: Boolean(process.env.LANGFLOW_API_URL), href: '/planning/assistant', detail: process.env.LANGFLOW_API_URL ? 'Langflow URL finns' : 'Ej kopplad ännu' },
  ]

  const blocking = checks.filter((check) => !check.ok).length

  return (
    <AppShell auth={auth} title="Systemhälsa" subtitle="Readiness-check för bolagets grunddata, säkerhet och viktiga integrationer.">
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-slate-300">Readiness</p>
          <h2 className="mt-2 text-2xl font-semibold">{blocking === 0 ? 'Bolaget ser redo ut' : `${blocking} saker behöver åtgärdas`}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Detta stoppar inte allt arbete, men live-drift och avancerad AI bör inte aktiveras förrän de viktigaste varningarna är hanterade.</p>
        </section>
        <section className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <Link key={check.label} href={check.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{check.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{check.detail}</p>
                </div>
                <StatusBadge status={check.ok ? 'OK' : 'Åtgärda'} tone={check.ok ? 'success' : 'warning'} />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
