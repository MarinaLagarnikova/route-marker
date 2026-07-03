import { YANDEX_MAPS_API_KEY } from '@/shared/config'
import type { MapAdapter } from './types'

// Minimal types for ymaps3 to avoid needing full @yandex/ymaps3-types package
interface YMaps3 {
  ready: Promise<void>
  YMap: new (container: HTMLElement, props: object) => YMap3Instance
  YMapDefaultSchemeLayer: new (props: object) => YMapEntity
  YMapSatelliteLayer: new (props: object) => YMapEntity
  YMapFeatureDataSource: new (props: { id: string }) => YMapEntity
  YMapFeatureLayer: new (props: { source: string }) => YMapEntity
  YMapFeature: new (props: object) => YMapEntity
  YMapMarker: new (props: object, element: HTMLElement) => YMapEntity
  YMapControls: new (props: object) => YMapEntity
}

interface YMap3Instance {
  addChild(child: YMapEntity): void
  removeChild(child: YMapEntity): void
  update(props: object): void
  destroy(): void
}

interface YMapEntity {
  [key: string]: unknown
}

declare global {
  interface Window {
    ymaps3: YMaps3
  }
}

let scriptLoaded = false
let scriptLoadPromise: Promise<void> | null = null

function loadYandexScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`
    script.onload = () => {
      scriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Не удалось загрузить Яндекс Карты'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

export function createYandexAdapter(): MapAdapter {
  let map: YMap3Instance | null = null
  let ymaps3: YMaps3 | null = null
  let trackFeatures: YMapEntity[] = []
  let checkpointMarkers: YMapEntity[] = []
  let userMarker: YMapEntity | null = null

  return {
    async init(container, center, zoom) {
      try {
        await loadYandexScript()
        await window.ymaps3.ready
        ymaps3 = window.ymaps3

        map = new ymaps3.YMap(container, {
          location: { center: [center.lon, center.lat], zoom },
        })

        map.addChild(new ymaps3.YMapDefaultSchemeLayer({}))

        const dataSource = new ymaps3.YMapFeatureDataSource({ id: 'main' })
        const featureLayer = new ymaps3.YMapFeatureLayer({ source: 'main' })
        map.addChild(dataSource)
        map.addChild(featureLayer)
      } catch (e) {
        console.warn('Яндекс Карты недоступны, карта работает без тайлов', e)
      }
    },

    destroy() {
      map?.destroy()
      map = null
    },

    drawTrack(points, checkedUpToTrackIndex) {
      if (!ymaps3 || !map) return

      trackFeatures.forEach((f) => {
        try { map!.removeChild(f) } catch { /* ignore */ }
      })
      trackFeatures = []

      const coords = points.map((p): [number, number] => [p.lon, p.lat])

      if (checkedUpToTrackIndex > 0) {
        const done = new ymaps3.YMapFeature({
          id: 'track-done',
          geometry: { type: 'LineString', coordinates: coords.slice(0, checkedUpToTrackIndex + 1) },
          style: { stroke: [{ color: '#e53e3e', width: 4 }] },
        })
        map.addChild(done)
        trackFeatures.push(done)
      }

      const remaining = new ymaps3.YMapFeature({
        id: 'track-remaining',
        geometry: {
          type: 'LineString',
          coordinates: coords.slice(Math.max(0, checkedUpToTrackIndex)),
        },
        style: { stroke: [{ color: '#9ca3af', width: 3, dash: [8, 6] }] },
      })
      map.addChild(remaining)
      trackFeatures.push(remaining)
    },

    drawCheckpoints(checkpoints, onTap) {
      if (!ymaps3 || !map) return

      checkpointMarkers.forEach((m) => {
        try { map!.removeChild(m) } catch { /* ignore */ }
      })
      checkpointMarkers = []

      checkpoints.forEach((cp, i) => {
        const el = document.createElement('div')
        el.style.cssText = [
          'width:28px', 'height:28px', 'border-radius:50%', 'cursor:pointer',
          `border:3px solid ${cp.checkedAt ? '#e53e3e' : '#374151'}`,
          `background:${cp.checkedAt ? '#e53e3e' : '#f9fafb'}`,
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:10px', 'font-weight:700',
          `color:${cp.checkedAt ? '#fff' : '#374151'}`,
        ].join(';')
        el.textContent = String(i + 1)
        el.addEventListener('click', () => onTap(i))

        const marker = new ymaps3!.YMapMarker({ coordinates: [cp.lon, cp.lat] }, el)
        map!.addChild(marker)
        checkpointMarkers.push(marker)
      })
    },

    updateUserPosition(pos) {
      if (!ymaps3 || !map) return
      if (userMarker) {
        try { map.removeChild(userMarker) } catch { /* ignore */ }
        userMarker = null
      }
      if (!pos) return

      const el = document.createElement('div')
      el.style.cssText = [
        'width:16px', 'height:16px', 'border-radius:50%',
        'background:#3b82f6', 'border:3px solid #fff',
        'box-shadow:0 0 0 3px rgba(59,130,246,0.4)',
      ].join(';')

      userMarker = new ymaps3.YMapMarker({ coordinates: [pos.lon, pos.lat] }, el)
      map.addChild(userMarker)
    },

    fitBounds(points) {
      if (!map || !points.length) return
      const lats = points.map((p) => p.lat)
      const lons = points.map((p) => p.lon)
      const sw: [number, number] = [Math.min(...lons), Math.min(...lats)]
      const ne: [number, number] = [Math.max(...lons), Math.max(...lats)]
      map.update({ location: { bounds: [sw, ne], duration: 300 } })
    },

    setLayer(_layer) {
      // Simplified: layer switching can be expanded later
    },
  }
}
