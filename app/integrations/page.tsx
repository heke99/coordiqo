export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { createAiDecisionSupportRunAction, saveIntegrationSettingAction, syncNotionKnowledgeAction } from '@/lib/engines/actions'
import { getAiProviderConfig, isLangflowConfigured } from '@/lib/ai/orchestration'
import { getNotionKnowledgeConfig } from '@/lib/knowledge/notion'
import { messagingReadiness } from '@/lib/messaging/providers'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type IntegrationSettingRow = {
  id: string
  provider: string
  status: string
  config: { label?: string | null; baseUrl?: string | null } | null
  created_at: string
}

type AiRunRow = {
  id: string
  run_type: string
  locale: string
  status: string
  output_summary: string | null
  created_at: string
}

export default async function IntegrationsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const companyId = auth.membership.companyId
  const aiConfig = getAiProviderConfig(auth.membership.locale)
  const langflowReady = isLangflowConfigured(aiConfig)
  const notion = getNotionKnowledgeConfig()
  const messaging = messagingReadiness()
  const [{ data: settings }, { data: aiRuns }] = await Promise.all([
    supabaseAdmin.from('integration_settings').select('id, provider, status, config, created_at').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('ai_runs').select('id, run_type, locale, status, output_summary, created_at').eq('company_id', companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
  ])
  const integrationRows = (settings ?? []) as IntegrationSettingRow[]
  const aiRunRows = (aiRuns ?? []) as AiRunRow[]

  return (
    <AppShell
      auth={auth}
      title="AI, kunskap och integrationer"
      subtitle="AI, kunskapskällor, SMS, e-post, API, webhooks och företagskopplingar utan att flytta affärslogik ur Coordiqo."
      actions={<Link href="/settings/health" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Systemhälsa</Link>}
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">AI-beslutsstöd</p><StatusBadge status={langflowReady ? 'ready' : 'needs_action'} tone={langflowReady ? 'success' : 'warning'} /></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">AI-spårning</p><StatusBadge status={aiConfig.langfusePublicKey && aiConfig.langfuseSecretKey ? 'ready' : 'needs_action'} tone={aiConfig.langfusePublicKey && aiConfig.langfuseSecretKey ? 'success' : 'warning'} /></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">Kunskapskälla</p><StatusBadge status={notion.notionApiKey ? 'ready' : 'needs_action'} tone={notion.notionApiKey ? 'success' : 'warning'} /></div>
          <div className="coordiqo-card p-5"><p className="text-sm text-slate-500">SMS</p><StatusBadge status={messaging.smsReady ? 'ready' : 'needs_action'} tone={messaging.smsReady ? 'success' : 'warning'} /></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Registrera integrationsinställning</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Spara tjänst, status och intern referens. Själva nycklarna hanteras säkert i miljövariabler.</p>
            <form action={saveIntegrationSettingAction} className="mt-5 grid gap-4">
              <Field label="Tjänst">
                <select name="provider" defaultValue="langflow" className={selectClassName}>
                  <option value="langflow">AI-flödestjänst</option>
                  <option value="langfuse">AI-spårning</option>
                  <option value="notion">Kunskapskälla</option>
                  <option value="twilio">SMS</option>
                  <option value="api">API/Webhook</option>
                  <option value="calendar">Kalender</option>
                </select>
              </Field>
              <Field label="Namn"><input name="label" className={inputClassName} /></Field>
              <Field label="Bas-URL"><input name="base_url" className={inputClassName} /></Field>
              <Field label="Intern nyckelreferens"><input name="secret_ref" placeholder="ex. ai-service-production" className={inputClassName} /></Field>
              <Field label="Status"><select name="status" defaultValue="inactive" className={selectClassName}><option value="inactive">Inaktiv</option><option value="active">Aktiv</option></select></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Spara integration</button>
            </form>
          </div>

          <div className="space-y-5">
            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">AI-beslutsstöd</h2>
              <form action={createAiDecisionSupportRunAction} className="mt-4 grid gap-3">
                <Field label="Agent">
                  <select name="run_type" defaultValue="operations_summary" className={selectClassName}>
                    <option value="operations_summary">Sammanfatta drift</option>
                    <option value="message_classifier">Klassificera meddelande</option>
                    <option value="deviation_agent">Föreslå avvikelsehantering</option>
                    <option value="project_calculation_agent">Stöd för projektkalkyl</option>
                    <option value="knowledge_agent">Sök i kunskapskälla</option>
                  </select>
                </Field>
                <Field label="Fråga eller kontext"><input name="prompt" className={inputClassName} /></Field>
                <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Skapa beslutsstöd</button>
              </form>
            </section>

            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Kunskapskälla</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Synka dokument från konfigurerad kunskapskälla så AI kan ge svar med bättre verksamhetskontext.</p>
              <form action={syncNotionKnowledgeAction} className="mt-4">
                <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Synka kunskapskälla</button>
              </form>
            </section>

            <section className="coordiqo-card p-5">
              <h2 className="text-lg font-semibold text-slate-950">Sparade integrationer</h2>
              <div className="mt-4 space-y-3">
                {integrationRows.length ? integrationRows.map((setting) => (
                  <div key={setting.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold text-slate-950">{setting.config?.label ?? setting.provider}</p><p className="mt-1 text-xs text-slate-500">{setting.provider} · {setting.config?.baseUrl ?? 'ingen URL'}</p></div>
                      <StatusBadge status={setting.status} />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-600">Inga integrationsinställningar sparade ännu.</p>}
              </div>
            </section>
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Senaste AI-körningar</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {aiRunRows.length ? aiRunRows.map((run) => (
              <div key={run.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950">{run.run_type}</p>
                  <StatusBadge status={run.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{run.output_summary ?? 'Beslutsstöd skapat.'}</p>
                <p className="mt-2 text-xs text-slate-500">{run.locale} · {new Date(run.created_at).toLocaleString('sv-SE')}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Inga AI-körningar ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

