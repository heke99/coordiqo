import { normalizeLocale, type Locale } from '@/lib/i18n/config'

export type AiRunContext = {
  companyId: string
  locale?: string | null
  runType: string
  input: Record<string, unknown>
}

export type AiProviderConfig = {
  langflowApiUrl: string | null
  langflowServerUrl: string | null
  langflowFlowId: string | null
  langflowApiKey: string | null
  langfusePublicKey: string | null
  langfuseSecretKey: string | null
  locale: Locale
}

export function getAiProviderConfig(locale?: string | null): AiProviderConfig {
  return {
    langflowApiUrl: process.env.LANGFLOW_API_URL ?? null,
    langflowServerUrl: process.env.LANGFLOW_SERVER_URL ?? null,
    langflowFlowId: process.env.LANGFLOW_FLOW_ID ?? null,
    langflowApiKey: process.env.LANGFLOW_API_KEY ?? null,
    langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? null,
    langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? null,
    locale: normalizeLocale(locale),
  }
}

export function getLangflowRunUrl(config: AiProviderConfig) {
  if (config.langflowApiUrl) return config.langflowApiUrl
  if (!config.langflowServerUrl || !config.langflowFlowId) return null

  const baseUrl = config.langflowServerUrl.replace(/\/+$/, '')
  return `${baseUrl}/api/v1/run/${config.langflowFlowId}?stream=false`
}

export function isLangflowConfigured(config: AiProviderConfig) {
  return Boolean(getLangflowRunUrl(config))
}

export function buildAiPromptContext(context: AiRunContext) {
  const config = getAiProviderConfig(context.locale)
  return {
    companyId: context.companyId,
    locale: config.locale,
    runType: context.runType,
    input: context.input,
    guardrails: {
      aiIsDecisionSupportOnly: true,
      sensitiveActionsRequireHumanApproval: true,
      auditDecisionRequired: true,
    },
  }
}

export async function callLangflow(context: AiRunContext) {
  const config = getAiProviderConfig(context.locale)
  const promptContext = buildAiPromptContext(context)
  const runUrl = getLangflowRunUrl(config)

  if (!runUrl) {
    return {
      provider: 'local',
      status: 'not_configured' as const,
      locale: config.locale,
      output: promptContext,
    }
  }

  const inputValue = [
    `locale: ${config.locale}`,
    `run_type: ${context.runType}`,
    `message: ${typeof context.input.prompt === 'string' ? context.input.prompt : JSON.stringify(context.input)}`,
    `company_context: ${JSON.stringify(promptContext)}`,
  ].join('\n')

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(config.langflowApiKey ? { 'x-api-key': config.langflowApiKey } : {}),
    },
    body: JSON.stringify({
      input_value: inputValue,
      input_type: 'chat',
      output_type: 'chat',
      session_id: `${context.companyId}:${context.runType}`,
    }),
  })

  return {
    provider: 'langflow',
    status: response.ok ? 'completed' as const : 'failed' as const,
    locale: config.locale,
    output: response.ok ? await response.json() : { status: response.status, body: await response.text() },
  }
}

