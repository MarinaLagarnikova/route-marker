import * as maptilersdk from '@maptiler/sdk'
import { MAP_API_KEY } from '@/shared/config'
import type { MapAdapter, PhotoPin } from './types'
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'
import { CATEGORY_PRIORITY, type RoutePoi } from '@/shared/lib/poi'
import { POI_ICON_IDS, registerPhotoPin, registerPoiIcons } from './poi-icons'

maptilersdk.config.apiKey = MAP_API_KEY

/** Значок кнопки слоя: звёздочка-«интересное», наследует цвет кнопки. */
const OVERLAY_TOGGLE_ICON = [
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto">',
  '<path d="M12 3.5 14.2 9.3 20 11.5 14.2 13.7 12 19.5 9.8 13.7 4 11.5 9.8 9.3z"/>',
  '</svg>',
].join('')

export function createMapTilerAdapter(): MapAdapter {
  let map: maptilersdk.Map | null = null
  let destroyed = false
  let tapHandler: ((index: number) => void) | null = null

  const TRACK_DONE_LAYER = 'track-done'
  const TRACK_REMAINING_LAYER = 'track-remaining'
  const POI_LAYER = 'poi-layer'
  const POI_SOURCE = 'poi-source'
  const PHOTO_LAYER = 'photo-layer'
  const PHOTO_SOURCE = 'photo-source'
  const MARKERS: maptilersdk.Marker[] = []
  let userMarker: maptilersdk.Marker | null = null
  let overlayVisible = true
  let overlayToggle: maptilersdk.IControl | null = null
  let syncToggleButton: (() => void) | null = null

  function applyOverlayVisibility() {
    const visibility = overlayVisible ? 'visible' : 'none'
    for (const layer of [POI_LAYER, PHOTO_LAYER]) {
      if (map?.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
    }
  }

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
          geolocateControl: false,
        })

        map = m

        m.on('load', () => {
          if (destroyed) { m.remove(); return }
          // GeolocateControl first — in bottom-right stack it ends up below NavigationControl
          m.addControl(new maptilersdk.MaptilerGeolocateControl({}), 'bottom-right')
          m.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'bottom-right')
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

    drawTrack(points: LatLon[], checkedUpToTrackIndex: number, segments?: LatLon[][]) {
      if (!map) return
      const coords = points.map((p): [number, number] => [p.lon, p.lat])

      const doneSourceId = 'track-done-source'
      const remainingSourceId = 'track-remaining-source'

      let doneGeometry: [number, number][][] = []
      let remainingGeometry: [number, number][][] = []

      if (segments && segments.length > 0) {
        // Split each segment into done/remaining portions by checkedUpToTrackIndex
        let offset = 0
        for (const seg of segments) {
          const segCoords = seg.map((p): [number, number] => [p.lon, p.lat])
          const segEnd = offset + seg.length - 1

          if (checkedUpToTrackIndex <= 0) {
            remainingGeometry.push(segCoords)
          } else if (checkedUpToTrackIndex >= segEnd) {
            if (segCoords.length >= 2) doneGeometry.push(segCoords)
          } else if (checkedUpToTrackIndex >= offset) {
            const localIdx = checkedUpToTrackIndex - offset
            if (localIdx + 1 >= 2) doneGeometry.push(segCoords.slice(0, localIdx + 1))
            if (segCoords.length - localIdx >= 2) remainingGeometry.push(segCoords.slice(localIdx))
          } else {
            remainingGeometry.push(segCoords)
          }
          offset += seg.length
        }
      } else {
        doneGeometry = checkedUpToTrackIndex > 0 ? [coords.slice(0, checkedUpToTrackIndex + 1)] : []
        remainingGeometry = [coords.slice(Math.max(0, checkedUpToTrackIndex))]
      }

      if (!map.getSource(doneSourceId)) {
        map.addSource(doneSourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] }, properties: {} } })
        map.addLayer({ id: TRACK_DONE_LAYER, type: 'line', source: doneSourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#171717', 'line-width': 4 } })
      }
      ;(map.getSource(doneSourceId) as maptilersdk.GeoJSONSource).setData({
        type: 'Feature', geometry: { type: 'MultiLineString', coordinates: doneGeometry }, properties: {},
      })

      if (!map.getSource(remainingSourceId)) {
        map.addSource(remainingSourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] }, properties: {} } })
        map.addLayer({ id: TRACK_REMAINING_LAYER, type: 'line', source: remainingSourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#6b7280', 'line-width': 3, 'line-dasharray': [2, 2] } })
      }
      ;(map.getSource(remainingSourceId) as maptilersdk.GeoJSONSource).setData({
        type: 'Feature', geometry: { type: 'MultiLineString', coordinates: remainingGeometry }, properties: {},
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

    async drawPois(pois: RoutePoi[], onTap: (poi: RoutePoi) => void) {
      if (!map) return
      await registerPoiIcons(map)
      if (!map) return

      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: pois.map((poi) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [poi.lon, poi.lat] },
          properties: {
            id: poi.id,
            category: poi.category,
            kind: poi.kind,
            name: poi.name ?? '',
            km: poi.km,
            icon: POI_ICON_IDS[poi.category],
            priority: CATEGORY_PRIORITY[poi.category],
          },
        })),
      }

      if (!map.getSource(POI_SOURCE)) {
        map.addSource(POI_SOURCE, { type: 'geojson', data })
        map.addLayer({
          id: POI_LAYER,
          type: 'symbol',
          source: POI_SOURCE,
          layout: {
            'icon-image': ['get', 'icon'],
            // 0.5 давало 14 px против 28 у марок контрольных точек — значки терялись
            'icon-size': 0.8,
            // Разрежением занимается сам движок: при наложении переживает тот,
            // у кого меньше ключ сортировки, то есть более важная категория.
            'icon-allow-overlap': false,
            'icon-ignore-placement': false,
            'symbol-sort-key': ['get', 'priority'],
          },
        })
        map.on('click', POI_LAYER, (event) => {
          const properties = event.features?.[0]?.properties
          if (!properties) return
          onTap({
            id: String(properties.id),
            category: properties.category,
            kind: properties.kind,
            ...(properties.name ? { name: String(properties.name) } : {}),
            lat: event.lngLat.lat,
            lon: event.lngLat.lng,
            km: Number(properties.km),
          } as RoutePoi)
        })
      } else {
        ;(map.getSource(POI_SOURCE) as maptilersdk.GeoJSONSource).setData(data)
      }
      applyOverlayVisibility()
    },

    async drawPhotoPins(photos: PhotoPin[], onTap: (index: number) => void) {
      if (!map) return

      const features: GeoJSON.Feature[] = []
      for (const [index, photo] of photos.entries()) {
        const iconId = `photo-${index}-${photo.src}`
        const ready = await registerPhotoPin(map, iconId, photo.src)
        if (!ready || !map) continue
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [photo.lon, photo.lat] },
          properties: { index, icon: iconId },
        })
      }
      if (!map) return

      const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
      if (!map.getSource(PHOTO_SOURCE)) {
        map.addSource(PHOTO_SOURCE, { type: 'geojson', data })
        map.addLayer({
          id: PHOTO_LAYER,
          type: 'symbol',
          source: PHOTO_SOURCE,
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 0.75,
            // Фотографий мало, и конкуренцию значкам они проигрывать не должны
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        map.on('click', PHOTO_LAYER, (event) => {
          const index = event.features?.[0]?.properties?.index
          if (index !== undefined) onTap(Number(index))
        })
      } else {
        ;(map.getSource(PHOTO_SOURCE) as maptilersdk.GeoJSONSource).setData(data)
      }
      applyOverlayVisibility()
    },

    setOverlayVisible(visible: boolean) {
      overlayVisible = visible
      applyOverlayVisibility()
      syncToggleButton?.()
    },

    addOverlayToggle(initialVisible: boolean, onToggle: (visible: boolean) => void) {
      if (!map || overlayToggle) return
      overlayVisible = initialVisible

      const container = document.createElement('div')
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
      const button = document.createElement('button')
      button.type = 'button'
      button.innerHTML = OVERLAY_TOGGLE_ICON
      container.appendChild(button)

      syncToggleButton = () => {
        button.setAttribute('aria-pressed', String(overlayVisible))
        button.title = overlayVisible ? 'Скрыть интересное' : 'Показать интересное'
        button.setAttribute('aria-label', button.title)
        button.style.background = overlayVisible ? '#171717' : '#ffffff'
        button.style.color = overlayVisible ? '#ffffff' : '#171717'
      }
      syncToggleButton()

      button.addEventListener('click', () => {
        overlayVisible = !overlayVisible
        applyOverlayVisibility()
        syncToggleButton?.()
        onToggle(overlayVisible)
      })

      overlayToggle = { onAdd: () => container, onRemove: () => container.remove() }
      map.addControl(overlayToggle, 'bottom-right')
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
    panTo(pos: LatLon) { map?.panTo([pos.lon, pos.lat]) },
  }
}
