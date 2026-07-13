import * as maptilersdk from '@maptiler/sdk'
import { MAP_API_KEY } from '@/shared/config'
import type { MapAdapter } from './types'
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'

maptilersdk.config.apiKey = MAP_API_KEY

export function createMapTilerAdapter(): MapAdapter {
  let map: maptilersdk.Map | null = null
  let destroyed = false
  let tapHandler: ((index: number) => void) | null = null

  const TRACK_SOURCE = 'track-source'
  const TRACK_DONE_LAYER = 'track-done'
  const TRACK_REMAINING_LAYER = 'track-remaining'
  const MARKERS: maptilersdk.Marker[] = []
  let userMarker: maptilersdk.Marker | null = null

  function clearMarkers() {
    MARKERS.forEach((m) => m.remove())
    MARKERS.length = 0
  }

  return {
    async init(container: HTMLElement, center: LatLon, zoom: number): Promise<void> {
      // Wait one tick so React StrictMode's first cleanup runs before we start
      await new Promise<void>((r) => setTimeout(r, 0))
      if (destroyed) return

      return new Promise((resolve, reject) => {
        const m = new maptilersdk.Map({
          container,
          style: 'streets-v2',
          center: [center.lon, center.lat],
          zoom,
          navigationControl: false,
        })

        map = m

        m.on('load', () => {
          if (destroyed) { m.remove(); return }
          m.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'top-right')
          resolve()
        })

        m.on('error', (e) => {
          if (!destroyed) reject(new Error(String(e.error?.message ?? 'Ошибка загрузки карты')))
        })
      })
    },

    destroy() {
      destroyed = true
      clearMarkers()
      userMarker?.remove()
      userMarker = null
      map?.remove()
      map = null
    },

    drawTrack(points: LatLon[], checkedUpToTrackIndex: number) {
      if (!map) return
      const coords = points.map((p): [number, number] => [p.lon, p.lat])

      // Ensure source exists
      if (!map.getSource(TRACK_SOURCE)) {
        map.addSource(TRACK_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      }

      // Done segment
      const doneCoords = checkedUpToTrackIndex > 0 ? coords.slice(0, checkedUpToTrackIndex + 1) : []
      const remainingCoords = coords.slice(Math.max(0, checkedUpToTrackIndex))

      const doneSourceId = 'track-done-source'
      const remainingSourceId = 'track-remaining-source'

      if (!map.getSource(doneSourceId)) {
        map.addSource(doneSourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } })
        map.addLayer({ id: TRACK_DONE_LAYER, type: 'line', source: doneSourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#171717', 'line-width': 4 } })
      }
      ;(map.getSource(doneSourceId) as maptilersdk.GeoJSONSource).setData({
        type: 'Feature', geometry: { type: 'LineString', coordinates: doneCoords }, properties: {},
      })

      if (!map.getSource(remainingSourceId)) {
        map.addSource(remainingSourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } })
        map.addLayer({ id: TRACK_REMAINING_LAYER, type: 'line', source: remainingSourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#6b7280', 'line-width': 3, 'line-dasharray': [2, 2] } })
      }
      ;(map.getSource(remainingSourceId) as maptilersdk.GeoJSONSource).setData({
        type: 'Feature', geometry: { type: 'LineString', coordinates: remainingCoords }, properties: {},
      })
    },

    drawCheckpoints(checkpoints: Checkpoint[], onTap: (index: number) => void, numbering: 'all' | 'checked-only' | 'none' = 'all') {
      if (!map) return
      tapHandler = onTap
      clearMarkers()

      checkpoints.forEach((cp, i) => {
        const checked = cp.checkedAt !== undefined
        const el = document.createElement('div')
        el.style.cssText = [
          'width:28px', 'height:28px', 'border-radius:50%', 'cursor:pointer',
          `border:2px solid ${checked ? '#171717' : '#9ca3af'}`,
          `background:${checked ? '#171717' : '#ffffff'}`,
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:11px', 'font-weight:600', 'font-family:monospace',
          `color:${checked ? '#fff' : '#0a0a0a'}`,
          'box-shadow:0 1px 4px rgba(0,0,0,0.2)',
          'user-select:none',
        ].join(';')
        el.textContent = numbering === 'all' || (numbering === 'checked-only' && checked)
          ? String(i + 1)
          : ''
        el.addEventListener('click', () => tapHandler?.(i))

        const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
          .setLngLat([cp.lon, cp.lat])
          .addTo(map!)
        MARKERS.push(marker)
      })
    },

    updateUserPosition(pos: LatLon | null) {
      if (!map) return
      userMarker?.remove()
      userMarker = null
      if (!pos) return

      const el = document.createElement('div')
      el.style.cssText = [
        'width:14px', 'height:14px', 'border-radius:50%',
        'background:#3b82f6', 'border:2.5px solid #fff',
        'box-shadow:0 0 0 3px rgba(59,130,246,0.35)',
      ].join(';')

      userMarker = new maptilersdk.Marker({ element: el, anchor: 'center' })
        .setLngLat([pos.lon, pos.lat])
        .addTo(map)
    },

    fitBounds(points: LatLon[]) {
      if (!map || points.length < 2) return
      const lons = points.map((p) => p.lon)
      const lats = points.map((p) => p.lat)
      map.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        { padding: 40, duration: 300 }
      )
    },

    setLayer(layer: 'map' | 'satellite' | 'hybrid') {
      if (!map) return
      if (layer === 'satellite') map.setStyle('satellite')
      else if (layer === 'hybrid') map.setStyle('hybrid')
      else map.setStyle('streets-v2')
    },

    zoomIn() { map?.zoomIn() },
    zoomOut() { map?.zoomOut() },
  }
}
