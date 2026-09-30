import { KIND_LABELS, type RoutePoi } from './types'

export interface PoiLabel {
  title: string
  subtitle: string
}

function formatKm(km: number): string {
  const rounded = Math.round(km * 10) / 10
  return `${rounded.toFixed(1).replace(/[.,]0$/, '').replace('.', ',')} км`
}

/**
 * Подпись для шторки объекта. У большинства объектов в OSM имени нет —
 * тогда заголовком становится вид, а километраж остаётся один в подзаголовке.
 */
export function poiLabel(poi: RoutePoi): PoiLabel {
  const kind = KIND_LABELS[poi.kind]
  const km = formatKm(poi.km)
  return poi.name
    ? { title: poi.name, subtitle: `${kind} · ${km}` }
    : { title: kind, subtitle: km }
}
