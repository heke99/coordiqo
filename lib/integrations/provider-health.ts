import { getAiProviderConfig, getLangflowRunUrl } from '@/lib/ai/orchestration'

type ProviderHealth = {
  key: string
  label: string
  ok: boolean
  detail: string
}

async function withTimeout(url: string, init?: RequestInit, timeoutMs = 3500) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function checkGraphHopperHealth(): Promise<ProviderHealth> {
  const baseUrl = process.env.GRAPHHOPPER_API_URL?.replace(/\/+$/, '')
  const key = process.env.GRAPHHOPPER_API_KEY
  if (!baseUrl || !key) return { key: 'graphhopper', label: 'GraphHopper', ok: false, detail: 'URL eller API-nyckel saknas.' }
  try {
    const url = new URL(`${baseUrl}/route`)
    url.searchParams.set('point', '59.3293,18.0686')
    url.searchParams.append('point', '59.3326,18.0649')
    url.searchParams.set('vehicle', 'car')
    url.searchParams.set('key', key)
    const response = await withTimeout(url.toString(), { next: { revalidate: 120 } })
    return { key: 'graphhopper', label: 'GraphHopper', ok: response.ok, detail: response.ok ? 'Ruttdata svarar.' : `Svarade ${response.status}.` }
  } catch (error) {
    return { key: 'graphhopper', label: 'GraphHopper', ok: false, detail: error instanceof Error ? error.message : 'Kunde inte nå ruttdata.' }
  }
}

export async function checkVroomHealth(): Promise<ProviderHealth> {
  const endpoint = process.env.VROOM_API_URL
  if (!endpoint) return { key: 'vroom', label: 'Ruttoptimering', ok: false, detail: 'URL saknas.' }
  try {
    const response = await withTimeout(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.VROOM_API_KEY ? { 'x-api-key': process.env.VROOM_API_KEY, authorization: `Bearer ${process.env.VROOM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        vehicles: [{ id: 1, start: [18.0686, 59.3293], end: [18.0686, 59.3293] }],
        jobs: [{ id: 1, location: [18.0649, 59.3326], service: 60 }],
      }),
    })
    return { key: 'vroom', label: 'Ruttoptimering', ok: response.ok, detail: response.ok ? 'Optimeringstjänsten svarar.' : `Svarade ${response.status}.` }
  } catch (error) {
    return { key: 'vroom', label: 'Ruttoptimering', ok: false, detail: error instanceof Error ? error.message : 'Kunde inte nå optimeringstjänsten.' }
  }
}

export async function checkLangflowHealth(locale = 'sv'): Promise<ProviderHealth> {
  const config = getAiProviderConfig(locale)
  const runUrl = getLangflowRunUrl(config)
  if (!runUrl || !config.langflowApiKey) return { key: 'langflow', label: 'AI-beslutsstöd', ok: false, detail: 'URL, flow eller API-nyckel saknas.' }
  try {
    const response = await withTimeout(runUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.langflowApiKey },
      body: JSON.stringify({ input_value: 'health check', input_type: 'chat', output_type: 'chat' }),
    })
    return { key: 'langflow', label: 'AI-beslutsstöd', ok: response.ok, detail: response.ok ? 'AI-tjänsten svarar.' : `Svarade ${response.status}.` }
  } catch (error) {
    return { key: 'langflow', label: 'AI-beslutsstöd', ok: false, detail: error instanceof Error ? error.message : 'Kunde inte nå AI-tjänsten.' }
  }
}

export async function getProviderHealth(locale = 'sv') {
  return Promise.all([checkGraphHopperHealth(), checkVroomHealth(), checkLangflowHealth(locale)])
}

