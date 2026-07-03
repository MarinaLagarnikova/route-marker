import { YANDEX_MAPS_API_KEY } from '@/shared/config'
import type { MapAdapter } from './types'

interface YMaps3 {
  ready: Promise<void>
  YMap: new (container: HTMLElement, props: object) => YMap3
  YMapDefaultSchemeLayer: new (props: object) => YMapEntity
  YMapSatelliteLayer: new (props: object) => YMapEntity
  YMapHybridLayer: new (props: object) => YMapEntity
  YMapFeatureDataSource: new (props: { id: string }) => YMapDataSource
  YMapFeatureLayer: new (props: { source: string }) => YMapEntity
  YMapFeature: new (props: object) => YMapEntity
  YMapMarker: new (props: object, element: HTMLElement) => YMapEntity
}

interface YMap3 {
  addChild(child: YMapEntity | YMapDataSource): void
  removeChild(child: YMapEntity | YMapDataSource): void
  update(props: object): void
  destroy(): void
}

interface YMapDataSource {
  addChild(child: YMapEntity): void
  removeChild(child: YMapEntity): void
}

interface YMapEntity {
  [key: string]: unknown
}

declare global {
  interface Window { ymaps3: YMaps3 }
}

let scriptLoadPromise: Promise<void> | null = null

function loadYandexScript(): Promise<void> {
  // Если скрипт уже в DOM — ждём ymaps3.ready
  if (window.ymaps3) return window.ymaps3.ready
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`
    script.onload = () => {
      window.ymaps3.ready.then(resolve).catch(reject)
    }
    script.onerror = () => {
      scriptLoadPromise = null
      document.head.removeChild(script)
      reject(new Error('Не удалось загрузить скрипт Яндекс Карт (проверьте ключ API и сеть)'))
    }
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

export function createYandexAdapter(): MapAdapter {
  let map: YMap3 | null = null
  let ymaps3: YMaps3 | null = null
  let dataSource: YMapDataSource | null = null
  let baseLayer: YMapEntity | null = null
  let destroyed = false

  // Features stored in dataSource
  let trackFeatures: YMapEntity[] = []
  // Markers stored directly on map
  let checkpointMarkers: YMapEntity[] = []
  let userMarker: YMapEntity | null = null

  function removeTrackFeatures() {
    if (!dataSource) return
    trackFeatures.forEach((f) => { try { dataSource!.removeChild(f) } catch { /* ignore */ } })
    trackFeatures = []
  }

  function removeCheckpointMarkers() {
    if (!map) return
    checkpointMarkers.forEach((m) => { try { map!.removeChild(m as YMapEntity) } catch { /* ignore */ } })
    checkpointMarkers = []
  }

  return {
    async init(container, center, zoom) {
      try {
        await loadYandexScript()
        if (destroyed) return   // cleanup ran while we were loading the script
        ymaps3 = window.ymaps3

        map = new ymaps3.YMap(container, {
          location: { center: [center.lon, center.lat], zoom },
        })

        // Base tile layer
        baseLayer = new ymaps3.YMapDefaultSchemeLayer({})
        map.addChild(baseLayer)

        // Feature data source + layer (for polylines)
        dataSource = new ymaps3.YMapFeatureDataSource({ id: 'track-source' })
        const featureLayer = new ymaps3.YMapFeatureLayer({ source: 'track-source' })
        map.addChild(dataSource)
        map.addChild(featureLayer)
      } catch (e) {
        console.warn('Яндекс Карты недоступны', e)
        throw e
      }
    },

    destroy() {
      destroyed = true
      map?.destroy()
      map = null
      dataSource = null
      baseLayer = null
      trackFeatures = []
      checkpointMarkers = []
      userMarker = null
    },

    drawTrack(points, checkedUpToTrackIndex) {
      if (!ymaps3 || !dataSource) return
      removeTrackFeatures()

      const coords = points.map((p): [number, number] => [p.lon, p.lat])

      // Пройденный участок — сплошная красная линия
      if (checkedUpToTrackIndex > 0) {
        const done = new ymaps3.YMapFeature({
          id: 'track-done',
          geometry: {
            type: 'LineString',
            coordinates: coords.slice(0, checkedUpToTrackIndex + 1),
          },
          style: { stroke: [{ color: '#171717', width: 4 }] },
        })
        dataSource.addChild(done)
        trackFeatures.push(done)
      }

      // Оставшийся участок — пунктирная серая линия
      const remaining = new ymaps3.YMapFeature({
        id: 'track-remaining',
        geometry: {
          type: 'LineString',
          coordinates: coords.slice(Math.max(0, checkedUpToTrackIndex)),
        },
        style: { stroke: [{ color: '#d4d4d4', width: 3, dash: [8, 6] }] },
      })
      dataSource.addChild(remaining)
      trackFeatures.push(remaining)
    },

    drawCheckpoints(checkpoints, onTap) {
      if (!ymaps3 || !map) return
      removeCheckpointMarkers()

      checkpoints.forEach((cp, i) => {
        const checked = cp.checkedAt !== undefined

        const el = document.createElement('div')
        el.style.cssText = [
          'width:24px', 'height:24px', 'border-radius:50%', 'cursor:pointer',
          `border:2px solid ${checked ? '#171717' : '#e5e5e5'}`,
          `background:${checked ? '#171717' : '#ffffff'}`,
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:10px', 'font-weight:600', 'font-family:monospace',
          `color:${checked ? '#fff' : '#0a0a0a'}`,
          'box-shadow:0 1px 3px rgba(0,0,0,0.15)',
          'user-select:none',
        ].join(';')
        el.textContent = String(i + 1)
        el.addEventListener('click', () => onTap(i))

        const marker = new ymaps3!.YMapMarker(
          { coordinates: [cp.lon, cp.lat], zIndex: 10 },
          el,
        )
        map!.addChild(marker as YMapEntity)
        checkpointMarkers.push(marker as YMapEntity)
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
        'width:14px', 'height:14px', 'border-radius:50%',
        'background:#3b82f6', 'border:2.5px solid #fff',
        'box-shadow:0 0 0 3px rgba(59,130,246,0.35)',
      ].join(';')

      userMarker = new ymaps3.YMapMarker(
        { coordinates: [pos.lon, pos.lat], zIndex: 20 },
        el,
      ) as unknown as YMapEntity
      map.addChild(userMarker)
    },

    fitBounds(points) {
      if (!map || points.length < 2) return
      const lats = points.map((p) => p.lat)
      const lons = points.map((p) => p.lon)
      const padding = 0.001 // небольшой отступ
      const sw: [number, number] = [Math.min(...lons) - padding, Math.min(...lats) - padding]
      const ne: [number, number] = [Math.max(...lons) + padding, Math.max(...lats) + padding]
      map.update({ location: { bounds: [sw, ne], duration: 300 } })
    },

    setLayer(layer) {
      if (!ymaps3 || !map || !baseLayer) return
      try { map.removeChild(baseLayer) } catch { /* ignore */ }
      if (layer === 'satellite') {
        baseLayer = new ymaps3.YMapSatelliteLayer({})
      } else if (layer === 'hybrid') {
        baseLayer = new ymaps3.YMapHybridLayer({})
      } else {
        baseLayer = new ymaps3.YMapDefaultSchemeLayer({})
      }
      map.addChild(baseLayer)
    },
  }
}
