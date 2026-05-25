import type { RouteMetricSummary, RoutingWaypoint } from '@/lib/routing/types'

const EARTH_RADIUS_METERS = 6371000
const DEFAULT_SPEED_KMH = 35

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function haversineDistanceMeters(a: Pick<RoutingWaypoint, 'latitude' | 'longitude'>, b: Pick<RoutingWaypoint, 'latitude' | 'longitude'>) {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

export function estimateDurationSeconds(distanceMeters: number, speedKmh = DEFAULT_SPEED_KMH) {
  if (!distanceMeters || distanceMeters <= 0) return 0
  const metersPerSecond = Math.max(5, speedKmh) * 1000 / 3600
  return Math.round(distanceMeters / metersPerSecond)
}

export function buildRouteMetricSummary(waypoints: RoutingWaypoint[], speedKmh = DEFAULT_SPEED_KMH): RouteMetricSummary {
  const usableWaypoints = waypoints.filter((waypoint) => Number.isFinite(waypoint.latitude) && Number.isFinite(waypoint.longitude))
  const legs = []
  let distanceMeters = 0
  let durationSeconds = 0

  for (let index = 1; index < usableWaypoints.length; index += 1) {
    const from = usableWaypoints[index - 1]
    const to = usableWaypoints[index]
    const legDistance = haversineDistanceMeters(from, to)
    const legDuration = estimateDurationSeconds(legDistance, speedKmh)
    distanceMeters += legDistance
    durationSeconds += legDuration
    legs.push({
      fromId: from.id,
      toId: to.id,
      distanceMeters: legDistance,
      durationSeconds: legDuration,
      quality: 'estimated' as const,
    })
  }

  const missingCoordinateCount = Math.max(0, waypoints.length - usableWaypoints.length)
  const quality = usableWaypoints.length < 2
    ? 'not_calculated'
    : missingCoordinateCount > 0
      ? 'partial'
      : 'estimated'

  return {
    stopCount: waypoints.length,
    geocodedStopCount: usableWaypoints.length,
    missingCoordinateCount,
    distanceMeters,
    durationSeconds,
    quality,
    legs,
  }
}

export function formatDistance(meters: number | null | undefined) {
  if (!meters || meters <= 0) return '—'
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
