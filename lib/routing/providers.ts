export type RoutingProviderEnvironment = {
  providerCode: 'estimated' | 'valhalla' | 'graphhopper'
  label: string
  configured: boolean
  baseUrl?: string | null
  apiKeyConfigured?: boolean
  styleUrl?: string | null
  detail: string
}

export function getRoutingProviderEnvironment(): RoutingProviderEnvironment {
  const valhallaUrl = process.env.VALHALLA_API_URL
  const graphhopperUrl = process.env.GRAPHHOPPER_API_URL
  const graphhopperApiKey = process.env.GRAPHHOPPER_API_KEY
  const mapStyleUrl = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL

  if (valhallaUrl) {
    return {
      providerCode: 'valhalla',
      label: 'Valhalla',
      configured: true,
      baseUrl: valhallaUrl,
      apiKeyConfigured: false,
      styleUrl: mapStyleUrl ?? null,
      detail: 'Valhalla är konfigurerad för routing/matrix.',
    }
  }

  if (graphhopperUrl) {
    return {
      providerCode: 'graphhopper',
      label: 'GraphHopper',
      configured: Boolean(graphhopperApiKey),
      baseUrl: graphhopperUrl,
      apiKeyConfigured: Boolean(graphhopperApiKey),
      styleUrl: mapStyleUrl ?? null,
      detail: graphhopperApiKey ? 'GraphHopper är konfigurerad för routing/matrix.' : 'GraphHopper URL finns men API-nyckel saknas.',
    }
  }

  return {
    providerCode: 'estimated',
    label: 'Intern uppskattning',
    configured: false,
    baseUrl: null,
    apiKeyConfigured: false,
    styleUrl: mapStyleUrl ?? null,
    detail: mapStyleUrl ? 'MapLibre style finns, men routingprovider saknas.' : 'Routingprovider och MapLibre style saknas ännu.',
  }
}
