export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type SaasReadinessRow = {
  readiness_status: string
  active_module_count: number
  planned_module_count: number
  optimization_runs: number
  project_calculations: number
  open_deviations: number
  chat_channels: number
  ai_runs: number
}

export default async function PilotReadinessPage() {
  const auth = await requireCompanyContext()
  const companyId = auth.membership.companyId
  const [{ data: readiness }, { count: staff }, { count: tasks }, { count: resources }, { count: projects }, { count: billing }] = await Promise.all([
    supabaseAdmin.from('coordiqo_saas_readiness_v').select('*').eq('company_id', companyId).maybeSingle(),
    supabaseAdmin.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('resource_assets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('billing_underlays').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
  ])
  const row = readiness as SaasReadinessRow | null
  const checks = [
    { label: 'Grundinställningar och moduler', ok: row?.readiness_status === 'ready', href: '/settings/health' },
    { label: 'Personal finns', ok: Number(staff ?? 0) > 0, href: '/staff' },
    { label: 'Uppdrag finns', ok: Number(tasks ?? 0) > 0, href: '/tasks' },
    { label: 'Resurser finns', ok: Number(resources ?? 0) > 0, href: '/resources' },
    { label: 'Projekt/kalkyl', ok: Number(projects ?? 0) > 0 && Number(row?.project_calculations ?? 0) > 0, href: '/projects' },
    { label: 'Optimering', ok: Number(row?.optimization_runs ?? 0) > 0, href: '/optimization' },
    { label: 'Avvikelser/historik', ok: Number(row?.open_deviations ?? 0) >= 0, href: '/deviations' },
    { label: 'Command Center', ok: Number(row?.chat_channels ?? 0) > 0, href: '/chat' },
    { label: 'AI beslutsstöd', ok: Number(row?.ai_runs ?? 0) > 0, href: '/integrations' },
    { label: 'Faktureringsunderlag', ok: Number(billing ?? 0) > 0, href: '/reports' },
  ]
  const testScenarios = [
    'Demoansökan sparas och intern notifiering skickas',
    'Plattformsadministratör skapar bolag från kvalificerad lead',
    'Plattformsadministratör skapar företagsadministratör med tillfälligt lösenord',
    'Första inloggningen kräver lösenordsbyte innan dashboard',
    'Onboarding slutförs och dashboard öppnas',
    'Uppdrag skapas, tilldelas och regelkontrolleras',
    'Ruttoptimering körs och ej planerade jobb granskas',
    'Uppdrag slutförs från mobil vy',
    'Avvikelse skapas och stängs',
    'AI-beslutsstöd skapas utan att fatta beslut automatiskt',
    'Kund-SMS skickas eller köas',
    'Tenant-isolering verifieras mellan två bolag',
  ]
  const ready = checks.filter((check) => check.ok).length

  return (
    <AppShell auth={auth} title="Driftberedskap" subtitle="Checklista för att göra bolaget redo för skarp drift.">
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-slate-300">Driftstatus</p>
          <h2 className="mt-2 text-3xl font-semibold">{ready}/{checks.length} klara steg</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Fyll på grunddata, kör optimering, skapa en kalkyl, öppna chattkanal, skapa AI-beslutsstöd och faktureringsunderlag för att visa hela plattformen.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <Link key={check.label} href={check.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{check.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{check.ok ? 'Klart.' : 'Behöver åtgärd.'}</p>
                </div>
                <StatusBadge status={check.ok ? 'Redo' : 'Behöver åtgärd'} tone={check.ok ? 'success' : 'warning'} />
              </div>
            </Link>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Testscenarier före skarp drift</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {testScenarios.map((scenario) => (
              <div key={scenario} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-950">
                {scenario}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

