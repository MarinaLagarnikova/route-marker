import { haversineKm } from '../geo'
import type { RoutePoi } from './types'

/** Ближе этого одноимённые объекты считаются одним и тем же. */
const SAME_PLACE_KM = 0.05

/**
 * Схлопывает объекты, размеченные в OSM дважды: одно имя, один вид, рядом друг
 * с другом — как «Братские корпуса» в Саввино-Сторожевском монастыре.
 *
 * Безымянные не трогаем: три родника подряд на восьмом километре — это три
 * родника, а не дубль.
 */
export function dedupeNearbyPois(pois: RoutePoi[]): RoutePoi[] {
  const kept: RoutePoi[] = []
  for (const poi of pois) {
    const duplicate = poi.name !== undefined && kept.some(
      (other) =>
        other.name === poi.name &&
        other.kind === poi.kind &&
        haversineKm(other, poi) <= SAME_PLACE_KM,
    )
    if (!duplicate) kept.push(poi)
  }
  return kept
}
