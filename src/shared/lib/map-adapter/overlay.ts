import type * as maptilersdk from '@maptiler/sdk'
import {
  CATEGORY_PRIORITY, PHOTO_MIN_ZOOM, POI_ZOOM_STEPS, type RoutePoi,
} from '@/shared/lib/poi'
import { leftOfBearing } from '@/shared/lib/geo'
import {
  POI_ICON_IDS, POI_PIN_ANCHOR_OFFSET, registerPhotoPin, registerPoiIcons,
} from './poi-icons'
import type { PhotoPin } from './types'

/**
 * Общая отрисовка слоя «Интересное» — её делят карта маршрута и карта подборки.
 */
export const OVERLAY_LAYERS = {
  poi: 'poi-layer',
  poiSource: 'poi-source',
  photo: 'photo-layer',
  photoAnchor: 'photo-anchor-layer',
  photoSource: 'photo-source',
} as const

/**
 * Насколько отвести плашку фотографии от тропы, CSS-пиксели. Плашка шириной
 * 36 px расходится с линией трека с запасом: от её края до линии остаётся ~8 px.
 */
const PHOTO_OFFSET = 26

/**
 * Ступени видимости объектов: ниже первой порог равен нулю, а приоритеты
 * начинаются с единицы — слой пуст.
 *
 * Ступень с нулевым зумом действует всегда, поэтому она становится порогом по
 * умолчанию, а не остановкой: `step` требует строго возрастающих остановок, и
 * нулевая рядом с нулевым умолчанием — лишняя.
 *
 * ВАЖНО: MapLibre пересчитывает ['zoom'] внутри filter только на целых зумах.
 * Дробный порог в POI_ZOOM_STEPS просто не сработает.
 */
function poiZoomFilter(): maptilersdk.FilterSpecification {
  const always = POI_ZOOM_STEPS.filter((step) => step.zoom <= 0)
  const base = always.length > 0 ? always[always.length - 1].maxPriority : 0
  const steps = POI_ZOOM_STEPS
    .filter((step) => step.zoom > 0)
    .flatMap((step) => [step.zoom, step.maxPriority])

  return [
    '<=', ['get', 'priority'], ['step', ['zoom'], base, ...steps],
  ] as unknown as maptilersdk.FilterSpecification
}

interface OverlayTaps {
  onPoiTap: (poi: RoutePoi) => void
  onPhotoTap: (index: number) => void
}

function poiFeatures(pois: RoutePoi[]): GeoJSON.FeatureCollection {
  // Объекты запечены в библиотеку и живут дольше кода: выброшенная категория
  // ещё какое-то время лежит в данных. Без значка её не нарисовать, и просить
  // у движка несуществующую картинку — только сыпать ошибками в консоль.
  const known = pois.filter((poi) => POI_ICON_IDS[poi.category] !== undefined)

  return {
    type: 'FeatureCollection',
    features: known.map((poi) => ({
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
      properties: { index, icon, offset: leftOfBearing(photo.bearing ?? 0, PHOTO_OFFSET) },
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
      // Ступени по зуму: на обзоре слой молчит, объекты проступают по важности
      filter: poiZoomFilter(),
      layout: {
        'icon-image': ['get', 'icon'],
        // Размер запечён в саму картинку (36×45), масштабировать её не нужно
        'icon-size': 1,
        // Метка — капля: место обозначает остриё, а не середина фигуры.
        // Сдвиг компенсирует поле под тень между остриём и краем картинки.
        'icon-anchor': 'bottom',
        'icon-offset': POI_PIN_ANCHOR_OFFSET,
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

    // Точка на настоящем месте съёмки. Плашка отведена вбок, и без якоря
    // непонятно, к чему она относится; выноску не нарисовать — линия живёт в
    // географии, а сдвиг в пикселях, и на каждом зуме они разъедутся.
    map.addLayer({
      id: OVERLAY_LAYERS.photoAnchor,
      type: 'circle',
      source: OVERLAY_LAYERS.photoSource,
      minzoom: PHOTO_MIN_ZOOM,
      paint: {
        'circle-radius': 3,
        'circle-color': '#171717',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    })

    map.addLayer({
      id: OVERLAY_LAYERS.photo,
      type: 'symbol',
      source: OVERLAY_LAYERS.photoSource,
      // Фотографии приходят последними, иначе вторая ступень объектов и снимки
      // приезжают одной волной
      minzoom: PHOTO_MIN_ZOOM,
      layout: {
        'icon-image': ['get', 'icon'],
        // Размер и тень запечены в картинку — масштабировать её нельзя,
        // иначе вместе с плашкой ужмётся и тень
        'icon-size': 1,
        // Значкам фото не уступают, а вот друг другу — да: иначе четыре снимка
        // у монастыря ложатся стопкой
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'symbol-sort-key': 0,
        // Снимки сделаны на тропе: без отвода плашка ляжет на линию трека
        'icon-offset': ['array', 'number', 2, ['get', 'offset']],
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
  for (const layer of [OVERLAY_LAYERS.poi, OVERLAY_LAYERS.photo, OVERLAY_LAYERS.photoAnchor]) {
    if (map?.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
  }
}

/**
 * Значок кнопки слоя — lucide `layers`, наследует цвет кнопки. Была звёздочка,
 * но «рукотворное» теперь рисуется звездой, и кнопка с ней перекликалась.
 */
const TOGGLE_ICON = [
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto">',
  '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91',
  'a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>',
  '<path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>',
  '<path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
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
