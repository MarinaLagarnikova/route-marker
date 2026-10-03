/**
 * Решения прогона добычи объектов: что берём и что пропускаем.
 *
 * Вынесено из `fetch-osm-pois.ts` отдельно, потому что именно от этих двух
 * ответов зависит, переживёт ли раскатка обрыв связи: цель определяет объём
 * захода, пропуск — что не придётся запрашивать у Overpass второй раз.
 */

/** Подходит ли маршрут под цель прогона: `--all`, имя подборки или id маршрута. */
export function matchesTarget(target: string, region: string, routeId: string): boolean {
  return target === '--all' || target === region || target === routeId
}

export interface SkipOptions {
  /** Забрать заново даже то, что уже лежит в данных. */
  force: boolean
  /** Пересчёт по запечённому, без сети. */
  localOnly: boolean
}

/**
 * Почему маршрут пропущен в этом прогоне, или null — если его надо обработать.
 *
 * Признак сделанной работы — наличие поля `pois`, а не его длина: пустой список
 * это законный ответ Overpass для глухого участка, и перезапрашивать такие
 * маршруты при каждой докачке значит никогда её не закончить.
 */
export function skipReason(
  route: { pois?: unknown; photos?: unknown },
  options: SkipOptions,
): string | null {
  if (options.localOnly) {
    // Пересчитывать нечего — и трогать нельзя: пустой список `pois` на
    // нетронутом маршруте выглядел бы как добытый и увёл бы его от сетевого
    // прогона навсегда
    const hasBaked = Array.isArray(route.pois) || Array.isArray(route.photos)
    return hasBaked ? null : 'нечего пересчитывать'
  }
  if (options.force) return null
  if (Array.isArray(route.pois)) return 'объекты уже добыты'
  return null
}
