import { normalizeLocale, type Locale } from '@/lib/i18n/config'

export type AiRunContext = {
  companyId: string
  locale?: string | null
  runType: string
  input: Record<string, unknown>
}

export type AiProviderConfig = {
  langflowApiUrl: string | null
  langflowApiKey: string | null
  langfusePublicKey: string | null
  langfuseSecretKey: string | null
  locale: Locale
}

export function getAiProviderConfig(locale?: string | null): AiProviderConfig {
  return {
    langflowApiUrl: process.env.LANGFLOW_API_URL ?? null,
    langflowApiKey: process.env.LANGFLOW_API_KEY ?? null,
    langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? null,
    langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? null,
    locale: normalizeLocale(locale),
  }
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

  if (!config.langflowApiUrl) {
    return {
      provider: 'local',
      status: 'not_configured' as const,
      locale: config.locale,
      output: promptContext,
    }
  }

  const response = await fetch(config.langflowApiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.langflowApiKey ? { authorization: `Bearer ${config.langflowApiKey}` } : {}),
    },
    body: JSON.stringify(promptContext),
  })

  return {
    provider: 'langflow',
    status: response.ok ? 'completed' as const : 'failed' as const,
    locale: config.locale,
    output: response.ok ? await response.json() : { status: response.status, body: await response.text() },
  }
}

