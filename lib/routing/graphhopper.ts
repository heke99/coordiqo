import { buildRouteMetricSummary } from '@/lib/routing/route-metrics'
import type { RouteMetricSummary, RoutingWaypoint } from '@/lib/routing/types'

type GraphHopperPath = {
  distance?: number
  time?: number
  points?: {
    coordinates?: Array<[number, number]>
  }
}

type GraphHopperRouteResponse = {
  paths?: GraphHopperPath[]
  message?: string
}

function graphhopperUrl() {
  const baseUrl = process.env.GRAPHHOPPER_API_URL?.replace(/\/+$/, '')
  const apiKey = process.env.GRAPHHOPPER_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

export function isGraphHopperReady() {
  return Boolean(graphhopperUrl())
}

export async function buildGraphHopperRouteMetricSummary(waypoints: RoutingWaypoint[]): Promise<RouteMetricSummary> {
  const config = graphhopperUrl()
  const fallback = buildRouteMetricSummary(waypoints)
  const usableWaypoints = waypoints.filter((waypoint) => Number.isFinite(waypoint.latitude) && Number.isFinite(waypoint.longitude))
  if (!config || usableWaypoints.length < 2) return fallback

  const legs: RouteMetricSummary['legs'] = []
  let distanceMeters = 0
  let durationSeconds = 0

  try {
    for (let index = 1; index < usableWaypoints.length; index += 1) {
      const from = usableWaypoints[index - 1]
      const to = usableWaypoints[index]
      const url = new URL(`${config.baseUrl}/route`)
      url.searchParams.set('point', `${from.latitude},${from.longitude}`)
      url.searchParams.append('point', `${to.latitude},${to.longitude}`)
      url.searchParams.set('vehicle', 'car')
      url.searchParams.set('locale', 'sv')
      url.searchParams.set('points_encoded', 'false')
      url.searchParams.set('key', config.apiKey)

      const response = await fetch(url, { next: { revalidate: 300 } })
      if (!response.ok) return fallback
      const payload = await response.json() as GraphHopperRouteResponse
      const path = payload.paths?.[0]
      if (!path) return fallback
      const legDistance = Math.round(path.distance ?? 0)
      const legDuration = Math.round((path.time ?? 0) / 1000)
      distanceMeters += legDistance
      durationSeconds += legDuration
      legs.push({
        fromId: from.id,
        toId: to.id,
        distanceMeters: legDistance,
        durationSeconds: legDuration,
        quality: 'provider',
      })
    }

    const missingCoordinateCount = Math.max(0, waypoints.length - usableWaypoints.length)
    return {
      stopCount: waypoints.length,
      geocodedStopCount: usableWaypoints.length,
      missingCoordinateCount,
      distanceMeters,
      durationSeconds,
      quality: missingCoordinateCount > 0 ? 'partial' : 'provider',
      legs,
    }
  } catch {
    return fallback
  }
}

export async function enrichRoutesWithGraphHopper<T extends { waypoints: RoutingWaypoint[]; metrics: RouteMetricSummary }>(routes: T[]) {
  if (!isGraphHopperReady()) return routes
  return Promise.all(routes.map(async (route) => ({
    ...route,
    metrics: await buildGraphHopperRouteMetricSummary(route.waypoints),
  })))
}

