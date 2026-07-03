export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getSalesEmail, getSupportEmail, isEmailSendingConfigured } from '@/lib/config/emails'
import { getIndustryRegistry } from '@/lib/industry/registry'
import { repairAllMissingDefaultsAction } from '@/lib/platform/admin-actions'
import { getRoutingProviderEnvironment } from '@/lib/routing/providers'
import { supabaseAdmin } from '@/lib/supabase/admin'

type CheckLevel = 'ok' | 'warning' | 'critical'

type GoLiveCheck = {
  label: string
  level: CheckLevel
  detail: string
  fixHint?: string
  repairable?: boolean
  href?: string
}

// Public legal routes shipped with the app.
const LEGAL_ROUTES = ['/integritetspolicy', '/villkor', '/personuppgiftsbitrade', '/cookies', '/sakerhet']

export default async function AdminGoLivePage() {
  const auth = await requirePlatformAdmin()

  const [registry, packagesRes, demoRes, rlsRes, companiesRes, settingsRes, runtimeRes, sessionsRes, funnelRes] = await Promise.all([
    getIndustryRegistry(),
    supabaseAdmin.from('packages').select('code', { count: 'exact', head: true }).is('archived_at', null),
    supabaseAdmin.from('demo_requests').select('id', { count: 'exact', head: true }),
    supabaseAdmin.rpc('coordiqo_tables_without_rls'),
    supabaseAdmin.from('companies').select('id, name').eq('status', 'active').is('archived_at', null),
    supabaseAdmin.from('company_settings').select('company_id'),
    supabaseAdmin.from('industry_runtime_configs').select('company_id'),
    supabaseAdmin.from('company_onboarding_sessions').select('company_id'),
    supabaseAdmin.from('coordiqo_demo_request_readiness_v').select('*').maybeSingle(),
  ])

  const routing = getRoutingProviderEnvironment()
  const activeIndustries = registry.filter((profile) => profile.isActive)

  const activeCompanies = companiesRes.data ?? []
  const hasSettings = new Set((settingsRes.data ?? []).map((row) => row.company_id))
  const hasRuntime = new Set((runtimeRes.data ?? []).map((row) => row.company_id))
  const hasSession = new Set((sessionsRes.data ?? []).map((row) => row.company_id))
  const missingSettings = activeCompanies.filter((company) => !hasSettings.has(company.id))
  const missingRuntime = activeCompanies.filter((company) => !hasRuntime.has(company.id))
  const missingSessions = activeCompanies.filter((company) => !hasSession.has(company.id))

  const tablesWithoutRls = (rlsRes.data ?? []) as { table_name: string }[]
  const serviceRoleLeaked = Object.keys(process.env).some((key) => key.startsWith('NEXT_PUBLIC_') && key.toUpperCase().includes('SERVICE_ROLE'))

  const checks: GoLiveCheck[] = [
    {
      label: 'Databas konfigurerad',
      level: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'critical',
      detail: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Databaskoppling finns.' : 'Databasadress saknas i miljövariablerna.',
      fixHint: 'Sätt NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    },
    {
      label: 'Serverbehörighet endast på servern',
      level: process.env.SUPABASE_SERVICE_ROLE_KEY && !serviceRoleLeaked ? 'ok' : 'critical',
      detail: serviceRoleLeaked
        ? 'En NEXT_PUBLIC-variabel innehåller serverbehörighet — den läcker till webbläsaren!'
        : process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Serverbehörigheten är korrekt server-side.' : 'SUPABASE_SERVICE_ROLE_KEY saknas.',
      fixHint: 'Serverbehörigheten får aldrig ligga i en NEXT_PUBLIC-variabel.',
    },
    {
      label: 'Publik webbadress',
      level: process.env.NEXT_PUBLIC_SITE_URL ? 'ok' : 'warning',
      detail: process.env.NEXT_PUBLIC_SITE_URL ? `Webbadress: ${process.env.NEXT_PUBLIC_SITE_URL}` : 'NEXT_PUBLIC_SITE_URL saknas — inbjudningslänkar kan bli fel.',
      fixHint: 'Sätt NEXT_PUBLIC_SITE_URL till produktionsdomänen.',
    },
    {
      label: 'E-postutskick',
      level: isEmailSendingConfigured() ? 'ok' : 'warning',
      detail: isEmailSendingConfigured() ? 'E-postleverantör är konfigurerad.' : 'Ingen e-postleverantör — utskick köas som manuella och kan skickas om från admin.',
      fixHint: 'Sätt RESEND_API_KEY för att aktivera automatiska utskick.',
    },
    {
      label: 'Kontaktadresser (sälj/support)',
      level: process.env.COORDIQO_SALES_EMAIL || process.env.COORDIQO_SUPPORT_EMAIL ? 'ok' : 'warning',
      detail: `Sälj: ${getSalesEmail()} · Support: ${getSupportEmail()}`,
      fixHint: 'Sätt COORDIQO_SALES_EMAIL, COORDIQO_SUPPORT_EMAIL och COORDIQO_LEGAL_EMAIL.',
    },
    {
      label: 'Branschregister',
      level: activeIndustries.length >= 2 ? 'ok' : 'critical',
      detail: `${activeIndustries.length} aktiva branscher i registret.`,
      fixHint: 'Kör branschregister-migreringen och kontrollera att branscher är aktiva.',
      href: '/admin/industries',
    },
    {
      label: 'Paket och prismodell',
      level: Number(packagesRes.count ?? 0) > 0 ? 'ok' : 'warning',
      detail: `${packagesRes.count ?? 0} paket i registret.`,
      fixHint: 'Kör paket-migreringen så att demo/pilot/standard/pro/enterprise finns.',
    },
    {
      label: 'Juridiska sidor',
      level: 'ok',
      detail: `Publika sidor: ${LEGAL_ROUTES.join(', ')}.`,
    },
    {
      label: 'Demoformulär',
      level: demoRes.error ? 'critical' : 'ok',
      detail: demoRes.error ? 'Demoansökningar kan inte läsas — kontrollera databasen.' : `Demoansökningar fungerar (${demoRes.count ?? 0} totalt).`,
      href: '/admin/demo-requests',
    },
    {
      label: 'Radskydd i databasen (RLS)',
      level: rlsRes.error ? 'warning' : tablesWithoutRls.length === 0 ? 'ok' : 'critical',
      detail: rlsRes.error
        ? 'Kunde inte kontrollera radskydd (kontrollfunktionen saknas — kör senaste migreringen).'
        : tablesWithoutRls.length === 0
          ? 'Alla tabeller har radskydd aktiverat.'
          : `Tabeller utan radskydd: ${tablesWithoutRls.map((row) => row.table_name).join(', ')}`,
      fixHint: 'Aktivera radskydd på tabellerna i en ny migrering.',
    },
    {
      label: 'Bolag utan grundinställningar',
      level: missingSettings.length === 0 ? 'ok' : 'critical',
      detail: missingSettings.length === 0 ? 'Alla aktiva bolag har inställningar.' : `${missingSettings.length} bolag saknar inställningar: ${missingSettings.map((company) => company.name).join(', ')}`,
      repairable: missingSettings.length > 0,
    },
    {
      label: 'Bolag utan branschkonfiguration',
      level: missingRuntime.length === 0 ? 'ok' : 'critical',
      detail: missingRuntime.length === 0 ? 'Alla aktiva bolag har branschkonfiguration.' : `${missingRuntime.length} bolag saknar konfiguration: ${missingRuntime.map((company) => company.name).join(', ')}`,
      repairable: missingRuntime.length > 0,
    },
    {
      label: 'Bolag utan onboarding',
      level: missingSessions.length === 0 ? 'ok' : 'warning',
      detail: missingSessions.length === 0 ? 'Alla aktiva bolag har en onboarding-session.' : `${missingSessions.length} bolag saknar onboarding: ${missingSessions.map((company) => company.name).join(', ')}`,
      repairable: missingSessions.length > 0,
    },
    {
      label: 'Dokumentlagring',
      level: process.env.SUPABASE_STORAGE_BUCKET ? 'ok' : 'warning',
      detail: process.env.SUPABASE_STORAGE_BUCKET ? `Lagringsyta: ${process.env.SUPABASE_STORAGE_BUCKET}` : 'SUPABASE_STORAGE_BUCKET saknas — standardnamn används.',
    },
    {
      label: 'Ruttberäkning',
      level: 'ok',
      detail: routing.configured ? `${routing.label} är konfigurerad.` : 'Ingen leverantör — säker intern uppskattning används.',
    },
    {
      label: 'AI-stöd',
      level: 'ok',
      detail: process.env.LANGFLOW_API_URL || process.env.LANGFLOW_SERVER_URL ? 'AI-stöd är konfigurerat.' : 'AI-stöd är avstängt tills konfiguration finns (säkert läge).',
    },
    {
      label: 'SMS',
      level: 'ok',
      detail: process.env.TWILIO_ACCOUNT_SID ? 'SMS är konfigurerat.' : 'SMS är avstängt tills konfiguration finns (säkert läge).',
    },
  ]

  const criticalCount = checks.filter((item) => item.level === 'critical').length
  const warningCount = checks.filter((item) => item.level === 'warning').length
  const hasRepairable = checks.some((item) => item.repairable)

  const funnel = funnelRes.data as Record<string, number> | null
  const funnelCards = funnel
    ? [
        { label: 'Demoansökningar', value: funnel.total_leads ?? 0 },
        { label: 'Kvalificerade', value: funnel.qualified_leads ?? 0 },
        { label: 'Bolag skapade', value: funnel.company_created_leads ?? 0 },
        { label: 'Onboarding startad', value: funnel.onboarding_started_leads ?? 0 },
        { label: 'Piloter startade', value: funnel.pilot_started_leads ?? 0 },
        { label: 'Vunna', value: funnel.won_leads ?? 0 },
        { label: 'Förlorade', value: funnel.lost_leads ?? 0 },
      ]
    : []

  const levelStyle: Record<CheckLevel, string> = {
    ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  }
  const levelLabel: Record<CheckLevel, string> = { ok: 'OK', warning: 'Varning', critical: 'Kritiskt' }

  return (
    <AppShell auth={auth} title="Go-live-kontroll" subtitle="Samlad beredskapskontroll inför produktion: miljö, register, säkerhet och bolagsdata.">
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Kontroller</p><p className="mt-2 text-3xl font-semibold text-slate-950">{checks.length}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Varningar</p><p className={`mt-2 text-3xl font-semibold ${warningCount ? 'text-amber-600' : 'text-slate-950'}`}>{warningCount}</p></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Kritiska</p><p className={`mt-2 text-3xl font-semibold ${criticalCount ? 'text-red-600' : 'text-slate-950'}`}>{criticalCount}</p></div>
        </section>

        {hasRepairable && (
          <section className="coordiqo-card border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-amber-950">Säker reparation tillgänglig</h2>
                <p className="mt-1 text-sm text-amber-800">Skapar saknade grundinställningar, branschkonfigurationer och onboarding-sessioner för alla aktiva bolag. Ändrar aldrig befintlig data.</p>
              </div>
              <form action={repairAllMissingDefaultsAction}>
                <button className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700">Reparera saknade standarder</button>
              </form>
            </div>
          </section>
        )}

        <section className="space-y-3">
          {checks.map((item) => (
            <div key={item.label} className="coordiqo-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  {item.fixHint && item.level !== 'ok' ? <p className="mt-1 text-xs text-slate-500">Åtgärd: {item.fixHint}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {item.href ? <Link href={item.href} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Öppna</Link> : null}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${levelStyle[item.level]}`}>{levelLabel[item.level]}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {funnelCards.length > 0 && (
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Säljtratt</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {funnelCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                  <p className="text-2xl font-semibold text-slate-950">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
