import { KIND_LABELS, type RoutePoi } from './types'

/**
 * Заголовок шторки объекта. У большинства объектов в OSM имени нет — тогда
 * заголовком становится вид. Вторую строку занимает название группы, поэтому
 * километраж и вид сюда не подмешиваются.
 */
export function poiLabel(poi: RoutePoi): string {
  return poi.name || KIND_LABELS[poi.kind]
}
