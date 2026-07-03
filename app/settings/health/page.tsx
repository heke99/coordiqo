export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { getAiProviderConfig, isLangflowConfigured } from '@/lib/ai/orchestration'
import { getNotionKnowledgeConfig } from '@/lib/knowledge/notion'
import { messagingReadiness } from '@/lib/messaging/providers'
import { requireCompanyContext } from '@/lib/auth/guards'
import { getFoundationHealthChecks } from '@/lib/tenancy/foundation-health'

function toneFor(check: { ok: boolean; severity: 'info' | 'warning' | 'critical' }) {
  if (check.ok) return 'success' as const
  if (check.severity === 'critical') return 'danger' as const
  if (check.severity === 'warning') return 'warning' as const
  return 'neutral' as const
}

export default async function SettingsHealthPage() {
  const auth = await requireCompanyContext()

  const foundationChecks = await getFoundationHealthChecks(auth.membership.companyId)
  const messaging = messagingReadiness()
  const notion = getNotionKnowledgeConfig()
  const aiConfig = getAiProviderConfig(auth.membership.locale)
  const langflowReady = isLangflowConfigured(aiConfig)
  const graphhopperReady = Boolean(process.env.GRAPHHOPPER_API_URL && process.env.GRAPHHOPPER_API_KEY)
  const routingReady = Boolean(process.env.VALHALLA_API_URL || graphhopperReady)
  const vroomReady = Boolean(process.env.VROOM_API_URL)
  const integrationChecks = [
    {
      key: 'email_provider',
      label: 'E-post konfigurerad',
      ok: Boolean(process.env.RESEND_API_KEY),
      severity: 'warning' as const,
      href: '/settings/invitations',
      detail: process.env.RESEND_API_KEY ? 'E-post kan skickas' : 'E-post är inte konfigurerad',
    },
    {
      key: 'storage_bucket',
      label: 'Dokumentlagring',
      ok: Boolean(process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents'),
      severity: 'info' as const,
      href: '/settings',
      detail: process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents',
    },
    {
      key: 'maps_provider',
      label: 'Karta och ruttdata',
      ok: routingReady || Boolean(process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL),
      severity: 'warning' as const,
      href: '/operations/today',
      detail: process.env.VALHALLA_API_URL
        ? 'Valhalla är konfigurerad'
        : graphhopperReady
          ? 'GraphHopper är konfigurerad'
          : process.env.GRAPHHOPPER_API_URL
            ? 'GraphHopper behöver kompletteras'
          : process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL
            ? 'Kartstil finns, ruttdata använder uppskattning'
            : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              ? 'Kartnyckel finns'
              : 'Routing/karta saknas ännu',
    },
    {
      key: 'vroom_provider',
      label: 'Ruttoptimering',
      ok: vroomReady,
      severity: 'info' as const,
      href: '/planning',
      detail: vroomReady ? 'Extern optimering är konfigurerad' : 'Intern optimering används tills extern tjänst kopplas',
    },
    {
      key: 'langflow_provider',
      label: 'AI-beslutsstöd',
      ok: langflowReady,
      severity: 'info' as const,
      href: '/planning/assistant',
      detail: langflowReady ? 'AI-tjänsten är kopplad' : 'AI-tjänsten är inte färdigkopplad',
    },
    {
      key: 'langfuse_provider',
      label: 'AI-spårning',
      ok: Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY),
      severity: 'info' as const,
      href: '/planning/assistant',
      detail: process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY ? 'AI-spårning är konfigurerad' : 'AI-spårning är inte konfigurerad',
    },
    {
      key: 'notion_provider',
      label: 'Kunskapskälla',
      ok: Boolean(notion.notionApiKey),
      severity: 'info' as const,
      href: '/settings',
      detail: notion.notionApiKey ? 'Kunskapskälla är konfigurerad' : 'Kunskapskälla kopplas när funktionen aktiveras',
    },
    {
      key: 'sms_provider',
      label: 'SMS',
      ok: messaging.smsReady,
      severity: 'info' as const,
      href: '/settings',
      detail: messaging.smsReady ? 'SMS är konfigurerat' : 'SMS är inte konfigurerat',
    },
  ]

  const checks = [...foundationChecks, ...integrationChecks]
  const critical = checks.filter((check) => !check.ok && check.severity === 'critical').length
  const warnings = checks.filter((check) => !check.ok && check.severity === 'warning').length

  return (
    <AppShell auth={auth} title="Systemhälsa" subtitle="Systemkontroll för företagsisolering, roller, grunddata, ändringslogg och viktiga integrationer.">
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-slate-300">Grundinställningar</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {critical === 0 && warnings === 0 ? 'Bolaget ser redo ut' : `${critical} kritiska saker · ${warnings} varningar`}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Grunden kontrollerar företagsisolering, roller, ändringslogg, operativa data och integrationer innan bolaget går vidare i drift.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <Link key={check.key} href={check.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{check.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{check.detail}</p>
                </div>
                <StatusBadge status={check.ok ? 'OK' : check.severity === 'critical' ? 'Kritisk' : 'Åtgärda'} tone={toneFor(check)} />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
