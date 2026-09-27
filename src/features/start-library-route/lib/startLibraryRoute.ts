import { parseGpx } from '@/shared/lib/gpx'
import { fetchRouteGpxXml } from '@/shared/lib/library-api'
import { storageGet, storageSet } from '@/shared/lib/storage'
import { useRouteStore, hashString } from '@/entities/route'
import type { RouteState } from '@/entities/route'
import type { LibraryRoute } from '@/entities/library-route'

/** Закреплённый маршрут хранится без полной геометрии — трек тянется по gpx. */
export type StartableRoute = Omit<LibraryRoute, 'track'>

/**
 * Готовит маршрут из библиотеки к прохождению и отдаёт управление стору.
 *
 * Тот же файл, открытый второй раз, продолжается с сохранёнными отметками:
 * ключ прогресса — хэш GPX, поэтому сначала ищем сохранённое состояние.
 * Навигацию вызывает место вызова — экранов, откуда маршрут стартует, несколько.
 * Возвращает false, если у маршрута нет трека: открывать нечего.
 */
export async function startLibraryRoute(route: StartableRoute): Promise<boolean> {
  if (!route.gpx) return false

  const xml = await fetchRouteGpxXml(route.region.id, route.gpx)
  const hash = hashString(xml)
  const existing = storageGet<RouteState>(hash)
  const { loadRoute, loadSaved } = useRouteStore.getState()

  if (existing) {
    // Маршруты, сохранённые до появления связи с библиотекой, её не знают.
    if (!existing.libraryRouteId) {
      existing.libraryRouteId = route.id
      storageSet(hash, existing)
    }
    loadSaved(existing)
    return true
  }

  const data = parseGpx(xml)
  loadRoute(route.name, data.trackPoints, data.waypoints, xml, data.trackSegments, route.id)
  return true
}
