export type RoutingProviderEnvironment = {
  providerCode: 'estimated' | 'valhalla' | 'graphhopper'
  label: string
  configured: boolean
  baseUrl?: string | null
  styleUrl?: string | null
  detail: string
}

export function getRoutingProviderEnvironment(): RoutingProviderEnvironment {
  const valhallaUrl = process.env.VALHALLA_API_URL
  const graphhopperUrl = process.env.GRAPHHOPPER_API_URL
  const mapStyleUrl = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL

  if (valhallaUrl) {
    return {
      providerCode: 'valhalla',
      label: 'Valhalla',
      configured: true,
      baseUrl: valhallaUrl,
      styleUrl: mapStyleUrl ?? null,
      detail: 'Valhalla är konfigurerad för routing/matrix.',
    }
  }

  if (graphhopperUrl) {
    return {
      providerCode: 'graphhopper',
      label: 'GraphHopper',
      configured: true,
      baseUrl: graphhopperUrl,
      styleUrl: mapStyleUrl ?? null,
      detail: 'GraphHopper är konfigurerad för routing/matrix.',
    }
  }

  return {
    providerCode: 'estimated',
    label: 'Intern uppskattning',
    configured: false,
    baseUrl: null,
    styleUrl: mapStyleUrl ?? null,
    detail: mapStyleUrl ? 'MapLibre style finns, men routingprovider saknas.' : 'Routingprovider och MapLibre style saknas ännu.',
  }
}
