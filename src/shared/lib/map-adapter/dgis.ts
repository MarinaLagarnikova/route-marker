import { load } from '@2gis/mapgl'
import { DGIS_API_KEY } from '@/shared/config'
import type { MapAdapter } from './types'

type MapGL = Awaited<ReturnType<typeof load>>
type DGMap = InstanceType<MapGL['Map']>
type Polyline = InstanceType<MapGL['Polyline']>
type HtmlMarker = InstanceType<MapGL['HtmlMarker']>

let loadPromise: Promise<MapGL> | null = null

function loadMapGL(): Promise<MapGL> {
  if (!loadPromise) {
    loadPromise = load()
  }
  return loadPromise
}

export function createDGisAdapter(): MapAdapter {
  let map: DGMap | null = null
  let api: MapGL | null = null
  let destroyed = false

  let trackPolylines: Polyline[] = []
  let checkpointMarkers: HtmlMarker[] = []
  let userMarker: HtmlMarker | null = null

  function clearTrack() {
    trackPolylines.forEach((p) => p.destroy())
    trackPolylines = []
  }

  function clearCheckpoints() {
    checkpointMarkers.forEach((m) => m.destroy())
    checkpointMarkers = []
  }

  return {
    async init(container, center, zoom) {
      api = await loadMapGL()
      if (destroyed) return

      map = new api.Map(container, {
        center: [center.lon, center.lat],
        zoom,
        key: DGIS_API_KEY,
        zoomControl: false,
      })
    },

    destroy() {
      destroyed = true
      clearTrack()
      clearCheckpoints()
      userMarker?.destroy()
      userMarker = null
      map?.destroy()
      map = null
    },

    drawTrack(points, checkedUpToTrackIndex) {
      if (!api || !map) return
      clearTrack()

      const coords = points.map((p): number[] => [p.lon, p.lat])

      if (checkedUpToTrackIndex > 0) {
        const done = new api.Polyline(map, {
          coordinates: coords.slice(0, checkedUpToTrackIndex + 1),
          color: '#171717',
          width: 4,
          zIndex: 2,
        })
        trackPolylines.push(done)
      }

      const remaining = new api.Polyline(map, {
        coordinates: coords.slice(Math.max(0, checkedUpToTrackIndex)),
        color: '#d4d4d4',
        width: 3,
        dashLength: 8,
        gapLength: 6,
        zIndex: 1,
      })
      trackPolylines.push(remaining)
    },

    drawCheckpoints(checkpoints, onTap) {
      if (!api || !map) return
      clearCheckpoints()

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
        el.textContent = String(i + 1)
        el.addEventListener('click', () => onTap(i))

        const marker = new api!.HtmlMarker(map!, {
          coordinates: [cp.lon, cp.lat],
          html: el,
          anchor: [14, 14],
        })
        checkpointMarkers.push(marker)
      })
    },

    updateUserPosition(pos) {
      if (!api || !map) return
      userMarker?.destroy()
      userMarker = null
      if (!pos) return

      const el = document.createElement('div')
      el.style.cssText = [
        'width:14px', 'height:14px', 'border-radius:50%',
        'background:#3b82f6', 'border:2.5px solid #fff',
        'box-shadow:0 0 0 3px rgba(59,130,246,0.35)',
      ].join(';')

      userMarker = new api.HtmlMarker(map, {
        coordinates: [pos.lon, pos.lat],
        html: el,
        anchor: [7, 7],
      })
    },

    fitBounds(points) {
      if (!api || !map || points.length < 2) return
      const lons = points.map((p) => p.lon)
      const lats = points.map((p) => p.lat)
      const bounds = new api.LngLatBoundsClass({
        southWest: [Math.min(...lons), Math.min(...lats)],
        northEast: [Math.max(...lons), Math.max(...lats)],
      })
      map.fitBounds(bounds, { padding: { top: 40, right: 40, bottom: 40, left: 40 } })
    },

    setLayer(_layer) { /* no-op */ },
  }
}
