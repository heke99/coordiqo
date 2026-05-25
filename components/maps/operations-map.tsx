import Link from 'next/link'

import { formatCoordinate } from '@/lib/routing/coordinates'
import { formatDistance, formatDuration } from '@/lib/routing/route-metrics'
import type { RouteMetricSummary, RoutingWaypoint } from '@/lib/routing/types'

type OperationsMapRoute = {
  key: string
  title: string
  waypoints: RoutingWaypoint[]
  metrics: RouteMetricSummary
  stopCount?: number
}

type OperationsMapProps = {
  routes: OperationsMapRoute[]
  unassignedWaypoints?: RoutingWaypoint[]
  providerLabel: string
  providerDetail: string
}

function boundsFor(points: RoutingWaypoint[]) {
  if (!points.length) return null
  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  }
}

function project(point: RoutingWaypoint, bounds: NonNullable<ReturnType<typeof boundsFor>>) {
  const padding = 8
  const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng)
  const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat)
  const x = padding + ((point.longitude - bounds.minLng) / lngSpan) * (100 - padding * 2)
  const y = padding + ((bounds.maxLat - point.latitude) / latSpan) * (100 - padding * 2)
  return { x, y }
}

export function OperationsMap({ routes, unassignedWaypoints = [], providerLabel, providerDetail }: OperationsMapProps) {
  const allRoutePoints = routes.flatMap((route) => route.waypoints)
  const allPoints = [...allRoutePoints, ...unassignedWaypoints]
  const bounds = boundsFor(allPoints)
  const totalDistance = routes.reduce((sum, route) => sum + route.metrics.distanceMeters, 0)
  const totalDuration = routes.reduce((sum, route) => sum + route.metrics.durationSeconds, 0)
  const missingCoordinates = routes.reduce((sum, route) => sum + Math.max(0, (route.stopCount ?? route.metrics.stopCount) - route.waypoints.length), 0)

  return (
    <section className="coordiqo-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Map & routing foundation</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Operationskarta</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{providerLabel} · {providerDetail}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="font-semibold text-slate-950">{allPoints.length}</p><p className="text-slate-500">punkter</p></div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="font-semibold text-slate-950">{formatDistance(totalDistance)}</p><p className="text-slate-500">sträcka</p></div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="font-semibold text-slate-950">{formatDuration(totalDuration)}</p><p className="text-slate-500">restid</p></div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-[360px] overflow-hidden bg-slate-100">
          <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          {bounds ? (
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label="Förenklad operationskarta med rutter och stopp">
              {routes.map((route, routeIndex) => {
                const points = route.waypoints.map((point) => project(point, bounds))
                const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
                return (
                  <g key={route.key}>
                    {points.length > 1 ? <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="0.7" className={routeIndex % 2 === 0 ? 'text-slate-950' : 'text-slate-500'} opacity="0.85" /> : null}
                    {route.waypoints.map((waypoint, index) => {
                      const point = project(waypoint, bounds)
                      return (
                        <g key={waypoint.id}>
                          <circle cx={point.x} cy={point.y} r="2.6" className="fill-white stroke-slate-950" strokeWidth="0.7" />
                          <text x={point.x} y={point.y + 0.7} textAnchor="middle" className="fill-slate-950 text-[3px] font-bold">{index + 1}</text>
                        </g>
                      )
                    })}
                  </g>
                )
              })}
              {unassignedWaypoints.map((waypoint) => {
                const point = project(waypoint, bounds)
                return <rect key={waypoint.id} x={point.x - 1.8} y={point.y - 1.8} width="3.6" height="3.6" rx="0.7" className="fill-amber-400 stroke-slate-950" strokeWidth="0.5" />
              })}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/85 p-6">
                <p className="font-semibold text-slate-950">Inga koordinater ännu</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Lägg latitud/longitud på objekt, uppdrag eller stopp för att kartan ska visa dagens operationsflöde.</p>
              </div>
            </div>
          )}
        </div>

        <div className="max-h-[460px] overflow-y-auto border-t border-slate-200 bg-white p-5 xl:border-l xl:border-t-0 coordiqo-scrollbar">
          {missingCoordinates ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {missingCoordinates} stopp saknar koordinater. De visas i listan men kan inte ritas på kartan.
            </div>
          ) : null}
          <div className="space-y-4">
            {routes.length ? routes.map((route) => (
              <div key={route.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{route.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{route.waypoints.length}/{route.stopCount ?? route.metrics.stopCount} stopp med koordinater · {formatDistance(route.metrics.distanceMeters)} · {formatDuration(route.metrics.durationSeconds)}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{route.metrics.quality}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {route.waypoints.map((waypoint, index) => (
                    <Link key={waypoint.id} href={waypoint.href ?? '#'} className="block rounded-2xl bg-white p-3 text-sm transition hover:bg-slate-100">
                      <div className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{waypoint.label ?? 'Stopp'}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatCoordinate(waypoint)}{waypoint.plannedAt ? ` · ${new Date(waypoint.plannedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )) : <p className="text-sm text-slate-600">Inga rutter med koordinater för valt datum.</p>}

            {unassignedWaypoints.length ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-950">Oplanerade stopp på kartan</p>
                <div className="mt-3 space-y-2">
                  {unassignedWaypoints.map((waypoint) => (
                    <Link key={waypoint.id} href={waypoint.href ?? '#'} className="block rounded-2xl bg-white/80 p-3 text-sm transition hover:bg-white">
                      <p className="font-semibold text-slate-950">{waypoint.label ?? 'Oplanerat uppdrag'}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatCoordinate(waypoint)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
