export type RoutingCoordinate = {
  latitude: number
  longitude: number
  label?: string | null
  source?: string | null
}

export type RoutingWaypoint = RoutingCoordinate & {
  id: string
  kind?: string | null
  status?: string | null
  plannedAt?: string | null
  href?: string | null
}

export type RouteMetricLeg = {
  fromId: string
  toId: string
  distanceMeters: number
  durationSeconds: number
  quality: 'estimated' | 'provider' | 'manual' | 'failed'
}

export type RouteMetricSummary = {
  stopCount: number
  geocodedStopCount: number
  missingCoordinateCount: number
  distanceMeters: number
  durationSeconds: number
  quality: 'estimated' | 'provider' | 'manual' | 'partial' | 'failed' | 'not_calculated'
  legs: RouteMetricLeg[]
}

export type RoutingProviderCode = 'estimated' | 'valhalla' | 'graphhopper' | 'manual'

export type RoutingProviderConfig = {
  companyId: string
  providerCode: RoutingProviderCode | string
  providerName?: string | null
  baseUrl?: string | null
  profile?: string | null
  isActive?: boolean | null
  isDefault?: boolean | null
  settings?: Record<string, unknown> | null
}
