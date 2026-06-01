'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useRef } from 'react'

import type { RoutingWaypoint } from '@/lib/routing/types'

type MapLibreOperationsMapProps = {
  waypoints: RoutingWaypoint[]
  styleUrl: string
}

export function MapLibreOperationsMap({ waypoints, styleUrl }: MapLibreOperationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || !styleUrl || mapRef.current) return
    const first = waypoints[0]
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: first ? [first.longitude, first.latitude] : [18.0686, 59.3293],
      zoom: first ? 10 : 5,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [styleUrl, waypoints])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: maplibregl.Marker[] = []
    const addData = () => {
      const coordinates = waypoints.map((waypoint) => [waypoint.longitude, waypoint.latitude])
      if (map.getSource('coordiqo-route')) {
        (map.getSource('coordiqo-route') as GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        })
      } else {
        map.addSource('coordiqo-route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
        })
        map.addLayer({
          id: 'coordiqo-route-line',
          type: 'line',
          source: 'coordiqo-route',
          paint: { 'line-color': '#0f172a', 'line-width': 3, 'line-opacity': 0.75 },
        })
      }

      waypoints.forEach((waypoint, index) => {
        const el = document.createElement('div')
        el.className = 'flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white shadow-lg ring-2 ring-white'
        el.textContent = String(index + 1)
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([waypoint.longitude, waypoint.latitude])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setText(waypoint.label ?? `Stopp ${index + 1}`))
          .addTo(map)
        markers.push(marker)
      })

      if (coordinates.length) {
        const bounds = coordinates.reduce((acc, coordinate) => acc.extend(coordinate as [number, number]), new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]))
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 500 })
      }
    }

    if (map.loaded()) addData()
    else map.once('load', addData)

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [waypoints])

  return <div ref={containerRef} className="absolute inset-0" aria-label="Interaktiv operationskarta" />
}

