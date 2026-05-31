export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { getAiProviderConfig, isLangflowConfigured } from '@/lib/ai/orchestration'
import { getNotionKnowledgeConfig } from '@/lib/knowledge/notion'
import { messagingReadiness } from '@/lib/messaging/providers'
import { requireAuth } from '@/lib/auth/session'
import { getFoundationHealthChecks } from '@/lib/tenancy/foundation-health'

function toneFor(check: { ok: boolean; severity: 'info' | 'warning' | 'critical' }) {
  if (check.ok) return 'success' as const
  if (check.severity === 'critical') return 'danger' as const
  if (check.severity === 'warning') return 'warning' as const
  return 'neutral' as const
}

export default async function SettingsHealthPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const foundationChecks = await getFoundationHealthChecks(auth.membership.companyId)
  const messaging = messagingReadiness()
  const notion = getNotionKnowledgeConfig()
  const aiConfig = getAiProviderConfig(auth.membership.locale)
  const langflowReady = isLangflowConfigured(aiConfig)
  const integrationChecks = [
    {
      key: 'email_provider',
      label: 'Email provider konfigurerad',
      ok: Boolean(process.env.RESEND_API_KEY),
      severity: 'warning' as const,
      href: '/settings/invitations',
      detail: process.env.RESEND_API_KEY ? 'Resend finns' : 'RESEND_API_KEY saknas',
    },
    {
      key: 'storage_bucket',
      label: 'Storage bucket namn finns',
      ok: Boolean(process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents'),
      severity: 'info' as const,
      href: '/settings',
      detail: process.env.SUPABASE_STORAGE_BUCKET ?? 'coordiqo-documents',
    },
    {
      key: 'maps_provider',
      label: 'Maps/routing provider',
      ok: Boolean(process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VALHALLA_API_URL || process.env.GRAPHHOPPER_API_URL),
      severity: 'warning' as const,
      href: '/operations/today',
      detail: process.env.VALHALLA_API_URL
        ? 'Valhalla URL finns'
        : process.env.GRAPHHOPPER_API_URL
          ? 'GraphHopper URL finns'
          : process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL
            ? 'MapLibre style finns'
            : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              ? 'Google Maps finns'
              : 'Routing/karta saknas ännu',
    },
    {
      key: 'vroom_provider',
      label: 'VROOM optimering',
      ok: Boolean(process.env.VROOM_API_URL),
      severity: 'info' as const,
      href: '/planning',
      detail: process.env.VROOM_API_URL ? 'VROOM URL finns' : 'Fallback-optimering används tills VROOM kopplas',
    },
    {
      key: 'langflow_provider',
      label: 'Langflow/AI provider',
      ok: langflowReady,
      severity: 'info' as const,
      href: '/planning/assistant',
      detail: langflowReady ? 'Langflow flow finns' : 'LANGFLOW_API_URL eller LANGFLOW_SERVER_URL + LANGFLOW_FLOW_ID saknas',
    },
    {
      key: 'langfuse_provider',
      label: 'Langfuse tracing',
      ok: Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY),
      severity: 'info' as const,
      href: '/planning/assistant',
      detail: process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY ? 'Langfuse nycklar finns' : 'Ej kopplad ännu',
    },
    {
      key: 'notion_provider',
      label: 'Notion kunskapskälla',
      ok: Boolean(notion.notionApiKey),
      severity: 'info' as const,
      href: '/settings',
      detail: notion.notionApiKey ? 'Notion API-nyckel finns' : 'Notion kopplas när kunskapsbasen aktiveras',
    },
    {
      key: 'sms_provider',
      label: 'SMS provider',
      ok: messaging.smsReady,
      severity: 'info' as const,
      href: '/settings',
      detail: messaging.smsReady ? 'SMS-provider finns' : 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN och TWILIO_FROM_NUMBER saknas',
    },
  ]

  const checks = [...foundationChecks, ...integrationChecks]
  const critical = checks.filter((check) => !check.ok && check.severity === 'critical').length
  const warnings = checks.filter((check) => !check.ok && check.severity === 'warning').length

  return (
    <AppShell auth={auth} title="Systemhälsa" subtitle="Readiness-check för tenant-isolering, roller, grunddata, audit och viktiga integrationer.">
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-slate-300">Foundation readiness</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {critical === 0 && warnings === 0 ? 'Bolaget ser redo ut' : `${critical} kritiska saker · ${warnings} varningar`}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Grunden kontrollerar tenant, roller, audit, operativa data och integrationsnycklar innan bolaget går vidare till pilot.
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
