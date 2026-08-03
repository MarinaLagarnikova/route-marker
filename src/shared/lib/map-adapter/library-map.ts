/**
 * Lightweight map adapter for library route preview maps.
 * Draws the full track in accent colour with a start-arrow marker.
 * Does NOT conform to the main MapAdapter interface intentionally —
 * it's a separate, simpler contract for read-only route previews.
 */
import * as maptilersdk from '@maptiler/sdk'
import { MAP_API_KEY } from '@/shared/config'
import type { GeoPoint } from '@/entities/library-route'

maptilersdk.config.apiKey = MAP_API_KEY

export interface LibraryMapHandle {
  destroy(): void
}

export interface LibraryMapOptions {
  /** Show navigation / geolocate controls */
  controls?: boolean
  /** Accent color for the track line (default: #FF7A29) */
  trackColor?: string
  /** Called when user taps the map (e.g. on fullscreen map to open drawer) */
  onTap?: () => void
}

/**
 * Initialize a library preview map in the given container.
 * Draws `track` as a solid accent-colored polyline with a start-arrow marker.
 * Returns a handle with `destroy()`.
 */
export async function initLibraryMap(
  container: HTMLElement,
  track: GeoPoint[],
  options: LibraryMapOptions = {}
): Promise<LibraryMapHandle> {
  const { controls = false, trackColor = '#FF7A29', onTap } = options

  if (track.length === 0) return { destroy: () => {} }

  // Wait one tick for React StrictMode
  await new Promise<void>((r) => setTimeout(r, 0))

  const center = track[0]
  let destroyed = false

  const m = new maptilersdk.Map({
    container,
    style: 'streets-v2',
    center: [center.lon, center.lat],
    zoom: 10,
    navigationControl: false,
    geolocateControl: false,
  })

  if (onTap) {
    m.on('click', onTap)
  }

  await new Promise<void>((resolve) => {
    m.on('load', () => {
      if (destroyed) { m.remove(); return }

      if (controls) {
        m.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'bottom-right')
      }

      // Draw track
      const coords: [number, number][] = track.map((p) => [p.lon, p.lat])
      m.addSource('lib-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      })
      m.addLayer({
        id: 'lib-track-line',
        type: 'line',
        source: 'lib-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': trackColor, 'line-width': 3.5 },
      })

      // Fit bounds to track
      const lons = track.map((p) => p.lon)
      const lats = track.map((p) => p.lat)
      m.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        { padding: 40, duration: 0 }
      )

      // Start arrow marker
      addStartArrowMarker(m, track)

      resolve()
    })

    m.on('error', () => resolve()) // degrade gracefully
  })

  return {
    destroy() {
      destroyed = true
      m.remove()
    },
  }
}

/**
 * Initialize a fullscreen multi-route library map.
 * Draws all provided routes; tapping a route calls `onRouteTap(routeId)`.
 */
export async function initCollectionMap(
  container: HTMLElement,
  routes: Array<{ id: string; track: GeoPoint[]; name: string }>,
  onRouteTap: (routeId: string) => void,
  controls = true,
  cancel: { cancelled: boolean } = { cancelled: false }
): Promise<LibraryMapHandle> {
  if (routes.length === 0) return { destroy: () => {} }

  await new Promise<void>((r) => setTimeout(r, 0))
  if (cancel.cancelled) return { destroy: () => {} }

  const firstRoute = routes[0]
  const center = firstRoute.track[0]
  let destroyed = false

  const m = new maptilersdk.Map({
    container,
    style: 'streets-v2',
    center: [center.lon, center.lat],
    zoom: 8,
    navigationControl: false,
    geolocateControl: false,
  })

  await new Promise<void>((resolve) => {
    m.on('load', () => {
      if (destroyed) { m.remove(); return }

      if (controls) {
        m.addControl(new maptilersdk.MaptilerGeolocateControl({}), 'bottom-right')
        m.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'bottom-right')
      }

      // Draw each route track
      routes.forEach((route, idx) => {
        const sourceId = `lib-route-${idx}`
        const layerId = `lib-route-line-${idx}`
        const coords: [number, number][] = route.track.map((p) => [p.lon, p.lat])

        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: { routeId: route.id },
          },
        })
        m.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#FF7A29', 'line-width': 3, 'line-opacity': 0.85 },
        })

        m.on('click', layerId, () => onRouteTap(route.id))
        m.on('mouseenter', layerId, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', layerId, () => { m.getCanvas().style.cursor = '' })

        // Start arrow marker
        addStartArrowMarker(m, route.track, () => onRouteTap(route.id))
      })

      // Fit all routes
      const allLons = routes.flatMap((r) => r.track.map((p) => p.lon))
      const allLats = routes.flatMap((r) => r.track.map((p) => p.lat))
      m.fitBounds(
        [[Math.min(...allLons), Math.min(...allLats)], [Math.max(...allLons), Math.max(...allLats)]],
        { padding: 60, duration: 0 }
      )

      resolve()
    })

    m.on('error', () => resolve())
  })

  return {
    destroy() {
      destroyed = true
      m.remove()
    },
  }
}

/**
 * Initialize a plain map with no routes — used as a placeholder until routes are added.
 */
export async function initPlainMap(
  container: HTMLElement,
  center: [number, number] = [37.6, 55.75], // Moscow
  zoom = 7
): Promise<LibraryMapHandle> {
  await new Promise<void>((r) => setTimeout(r, 0))

  let destroyed = false
  const m = new maptilersdk.Map({
    container,
    style: 'streets-v2',
    center,
    zoom,
    navigationControl: false,
    geolocateControl: false,
  })

  m.on('load', () => { if (destroyed) m.remove() })
  m.on('error', () => {})

  return {
    destroy() {
      destroyed = true
      m.remove()
    },
  }
}

/**
 * Initialize a mini-map showing only start markers for each route.
 * Used in the collection page header mini-map.
 */
export async function initStartMarkersMap(
  container: HTMLElement,
  routes: Array<{ id: string; track: GeoPoint[]; name: string }>,
  onRouteTap: (routeId: string) => void,
  cancel: { cancelled: boolean } = { cancelled: false }
): Promise<LibraryMapHandle> {
  if (routes.length === 0) return { destroy: () => {} }

  await new Promise<void>((r) => setTimeout(r, 0))
  if (cancel.cancelled) return { destroy: () => {} }

  const firstRoute = routes[0]
  const center = firstRoute.track[0]
  let destroyed = false

  const m = new maptilersdk.Map({
    container,
    style: 'streets-v2',
    center: [center.lon, center.lat],
    zoom: 8,
    navigationControl: false,
    geolocateControl: false,
  })

  const markers: maptilersdk.Marker[] = []

  await new Promise<void>((resolve) => {
    m.on('load', () => {
      if (destroyed) { m.remove(); return }

      routes.forEach((route) => {
        if (route.track.length === 0) return
        const markerEl = addStartArrowMarker(m, route.track, () => onRouteTap(route.id))
        if (markerEl) markers.push(markerEl)
      })

      // Fit all start points
      const allLons = routes.map((r) => r.track[0]?.lon ?? 0).filter(Boolean)
      const allLats = routes.map((r) => r.track[0]?.lat ?? 0).filter(Boolean)
      if (allLons.length >= 2) {
        m.fitBounds(
          [[Math.min(...allLons), Math.min(...allLats)], [Math.max(...allLons), Math.max(...allLats)]],
          { padding: 48, duration: 0 }
        )
      }

      resolve()
    })

    m.on('error', () => resolve())
  })

  return {
    destroy() {
      destroyed = true
      markers.forEach((mk) => mk.remove())
      m.remove()
    },
  }
}

function addStartArrowMarker(
  map: maptilersdk.Map,
  track: GeoPoint[],
  onClick?: () => void
): maptilersdk.Marker | null {
  if (track.length === 0) return null

  const start = track[0]

  const el = document.createElement('div')
  el.style.cssText = 'width:28px;height:36px;cursor:pointer;'
  el.innerHTML = `
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- White border layer -->
      <circle cx="14" cy="13" r="13" fill="white"/>
      <path d="M8 22 L14 35 L20 22" fill="white"/>
      <!-- Orange body -->
      <circle cx="14" cy="13" r="11.5" fill="#FF7A29"/>
      <path d="M9 22 L14 34 L19 22" fill="#FF7A29"/>
      <!-- White inner circle -->
      <circle cx="14" cy="13" r="8" fill="white"/>
      <!-- Navigation arrow, upper-right 45° -->
      <path d="M14 7 L19 19 L14 16 L9 19 Z" fill="#FF7A29"
            transform="rotate(45 14 13)"/>
    </svg>
  `

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onClick()
    })
  }

  const marker = new maptilersdk.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([start.lon, start.lat])
    .addTo(map)

  return marker
}

function bearing(a: GeoPoint, b: GeoPoint): number {
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
