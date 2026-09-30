import type * as maptilersdk from '@maptiler/sdk'
import { CATEGORY_PRIORITY, type RoutePoi } from '@/shared/lib/poi'
import { POI_ICON_IDS, registerPhotoPin, registerPoiIcons } from './poi-icons'
import type { PhotoPin } from './types'

/**
 * Общая отрисовка слоя «Интересное» — её делят карта маршрута и карта подборки.
 */
export const OVERLAY_LAYERS = {
  poi: 'poi-layer',
  poiSource: 'poi-source',
  photo: 'photo-layer',
  photoSource: 'photo-source',
} as const

interface OverlayTaps {
  onPoiTap: (poi: RoutePoi) => void
  onPhotoTap: (index: number) => void
}

function poiFeatures(pois: RoutePoi[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [poi.lon, poi.lat] },
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
}

export async function drawOverlay(
  map: maptilersdk.Map,
  pois: RoutePoi[],
  photos: PhotoPin[],
  taps: OverlayTaps,
): Promise<void> {
  await registerPoiIcons(map)

  const photoFeatures: GeoJSON.Feature[] = []
  for (const [index, photo] of photos.entries()) {
    const icon = `photo-${photo.src}`
    if (!(await registerPhotoPin(map, icon, photo.src))) continue
    photoFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [photo.lon, photo.lat] },
      properties: { index, icon },
    })
  }

  const poiData = poiFeatures(pois)
  const photoData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: photoFeatures,
  }

  if (!map.getSource(OVERLAY_LAYERS.poiSource)) {
    map.addSource(OVERLAY_LAYERS.poiSource, { type: 'geojson', data: poiData })
    map.addLayer({
      id: OVERLAY_LAYERS.poi,
      type: 'symbol',
      source: OVERLAY_LAYERS.poiSource,
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
    map.on('click', OVERLAY_LAYERS.poi, (event) => {
      const properties = event.features?.[0]?.properties
      if (!properties) return
      taps.onPoiTap({
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
    ;(map.getSource(OVERLAY_LAYERS.poiSource) as maptilersdk.GeoJSONSource).setData(poiData)
  }

  if (!map.getSource(OVERLAY_LAYERS.photoSource)) {
    map.addSource(OVERLAY_LAYERS.photoSource, { type: 'geojson', data: photoData })
    map.addLayer({
      id: OVERLAY_LAYERS.photo,
      type: 'symbol',
      source: OVERLAY_LAYERS.photoSource,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.75,
        // Фотографий мало, и конкуренцию значкам они проигрывать не должны
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
    map.on('click', OVERLAY_LAYERS.photo, (event) => {
      const index = event.features?.[0]?.properties?.index
      if (index !== undefined) taps.onPhotoTap(Number(index))
    })
  } else {
    ;(map.getSource(OVERLAY_LAYERS.photoSource) as maptilersdk.GeoJSONSource).setData(photoData)
  }
}

/** Прячет или показывает оба слоя, если они уже созданы. */
export function applyOverlayVisibility(map: maptilersdk.Map | null, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none'
  for (const layer of [OVERLAY_LAYERS.poi, OVERLAY_LAYERS.photo]) {
    if (map?.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
  }
}

/** Значок кнопки слоя: звёздочка-«интересное», наследует цвет кнопки. */
const TOGGLE_ICON = [
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto">',
  '<path d="M12 3.5 14.2 9.3 20 11.5 14.2 13.7 12 19.5 9.8 13.7 4 11.5 9.8 9.3z"/>',
  '</svg>',
].join('')

export interface OverlayToggle {
  control: maptilersdk.IControl
  sync(visible: boolean): void
}

/** Кнопка слоя в стеке контролов карты — рядом с зумом и геолокацией. */
export function createOverlayToggle(onClick: () => void): OverlayToggle {
  const container = document.createElement('div')
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group'
  const button = document.createElement('button')
  button.type = 'button'
  button.innerHTML = TOGGLE_ICON
  button.addEventListener('click', onClick)
  container.appendChild(button)

  return {
    control: { onAdd: () => container, onRemove: () => container.remove() },
    sync(visible: boolean) {
      button.setAttribute('aria-pressed', String(visible))
      button.title = visible ? 'Скрыть интересное' : 'Показать интересное'
      button.setAttribute('aria-label', button.title)
      button.style.background = visible ? '#171717' : '#ffffff'
      button.style.color = visible ? '#ffffff' : '#171717'
    },
  }
}
