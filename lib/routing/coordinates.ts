import type { RoutingCoordinate } from '@/lib/routing/types'

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function validLatitude(value: number | null) {
  return value !== null && value >= -90 && value <= 90
}

function validLongitude(value: number | null) {
  return value !== null && value >= -180 && value <= 180
}

export function isValidCoordinate(coordinate: Pick<RoutingCoordinate, 'latitude' | 'longitude'> | null | undefined) {
  if (!coordinate) return false
  return validLatitude(coordinate.latitude) && validLongitude(coordinate.longitude)
}

export function coordinateFromValues(latitude: unknown, longitude: unknown, label?: string | null, source?: string | null): RoutingCoordinate | null {
  const lat = asNumber(latitude)
  const lng = asNumber(longitude)
  if (lat === null || lng === null || !validLatitude(lat) || !validLongitude(lng)) return null
  return { latitude: lat, longitude: lng, label: label ?? null, source: source ?? null }
}

export function coordinateFromCustomFields(fields: Record<string, unknown> | null | undefined, label?: string | null): RoutingCoordinate | null {
  if (!fields) return null
  return (
    coordinateFromValues(fields.latitude, fields.longitude, label, 'custom_fields.latitude_longitude') ??
    coordinateFromValues(fields.lat, fields.lng, label, 'custom_fields.lat_lng') ??
    coordinateFromValues(fields.location_latitude, fields.location_longitude, label, 'custom_fields.location') ??
    coordinateFromValues(fields.pickup_latitude, fields.pickup_longitude, label, 'custom_fields.pickup') ??
    coordinateFromValues(fields.dropoff_latitude, fields.dropoff_longitude, label, 'custom_fields.dropoff')
  )
}

export function formatCoordinate(coordinate: RoutingCoordinate | null | undefined) {
  if (!coordinate) return 'Koordinat saknas'
  return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`
}
