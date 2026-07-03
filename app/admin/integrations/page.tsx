export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getFromEmail, getSalesEmail, getSupportEmail, isEmailSendingConfigured } from '@/lib/config/emails'
import { getRoutingProviderEnvironment } from '@/lib/routing/providers'
import { supabaseAdmin } from '@/lib/supabase/admin'

type IntegrationStatus = { name: string; state: 'active' | 'fallback' | 'disabled'; detail: string }

export default async function AdminIntegrationsPage() {
  const auth = await requirePlatformAdmin()
  const routing = getRoutingProviderEnvironment()

  const { data: integrationSettings } = await supabaseAdmin
    .from('integration_settings')
    .select('id, scope, provider, status, company_id, companies(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const integrations: IntegrationStatus[] = [
    {
      name: 'E-post (Resend)',
      state: isEmailSendingConfigured() ? 'active' : 'fallback',
      detail: isEmailSendingConfigured()
        ? `Aktiv. Avsändare: ${getFromEmail()}`
        : 'Inte konfigurerad — e-post köas som manuella utskick i stället för att skickas.',
    },
    {
      name: 'Ruttberäkning',
      state: routing.configured ? 'active' : 'fallback',
      detail: routing.configured ? `${routing.label} är konfigurerad.` : 'Ingen leverantör — intern uppskattning används.',
    },
    {
      name: 'Ruttoptimering (VROOM)',
      state: process.env.VROOM_API_URL ? 'active' : 'fallback',
      detail: process.env.VROOM_API_URL ? 'VROOM är konfigurerad.' : 'Inte konfigurerad — enklare intern optimering används.',
    },
    {
      name: 'AI-stöd (Langflow)',
      state: process.env.LANGFLOW_API_URL || process.env.LANGFLOW_SERVER_URL ? 'active' : 'disabled',
      detail: process.env.LANGFLOW_API_URL || process.env.LANGFLOW_SERVER_URL ? 'Langflow är konfigurerad.' : 'Avstängd — AI-funktioner är inaktiva tills konfiguration finns.',
    },
    {
      name: 'SMS (Twilio)',
      state: process.env.TWILIO_ACCOUNT_SID ? 'active' : 'disabled',
      detail: process.env.TWILIO_ACCOUNT_SID ? 'Twilio är konfigurerad.' : 'Avstängd — SMS-utskick är inaktiva tills konfiguration finns.',
    },
    {
      name: 'Karta (MapLibre)',
      state: process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL ? 'active' : 'fallback',
      detail: process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL ? 'Kartstil är konfigurerad.' : 'Kartstil saknas — kartan visas med begränsad stil.',
    },
    {
      name: 'Dokumentlagring',
      state: process.env.SUPABASE_STORAGE_BUCKET ? 'active' : 'fallback',
      detail: process.env.SUPABASE_STORAGE_BUCKET ? `Lagringsyta: ${process.env.SUPABASE_STORAGE_BUCKET}` : 'Standardlagringsyta används.',
    },
    {
      name: 'Kontaktadresser',
      state: process.env.COORDIQO_SALES_EMAIL || process.env.COORDIQO_SUPPORT_EMAIL ? 'active' : 'fallback',
      detail: `Sälj: ${getSalesEmail()} · Support: ${getSupportEmail()}`,
    },
  ]

  const stateLabel = { active: 'Aktiv', fallback: 'Reservläge', disabled: 'Avstängd' } as const
  const stateTone = { active: 'success' as const, fallback: 'warning' as const, disabled: 'neutral' as const }

  return (
    <AppShell auth={auth} title="Integrationer" subtitle="Status för externa tjänster. Allt har säkra reservlägen — inget stoppar plattformen om en tjänst saknas.">
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <div key={integration.name} className="coordiqo-card p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-950">{integration.name}</h2>
                <StatusBadge status={stateLabel[integration.state]} tone={stateTone[integration.state]} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{integration.detail}</p>
            </div>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Bolagsspecifika integrationsinställningar</h2>
          <div className="mt-4 space-y-3">
            {integrationSettings?.length ? integrationSettings.map((setting: any) => (
              <div key={setting.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{setting.provider}</p>
                    <p className="mt-1 text-xs text-slate-500">{setting.scope === 'platform' ? 'Plattformsnivå' : setting.companies?.name ?? 'Bolag'}</p>
                  </div>
                  <StatusBadge status={setting.status} tone={setting.status === 'active' ? 'success' : 'neutral'} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-600">Inga bolagsspecifika integrationsinställningar registrerade.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
