import type { RoutePoi } from './types'

/**
 * Отсев видов объектов, назначенный конкретному маршруту.
 *
 * Общая таблица отбора решает, что вообще бывает на слое, и она одна на всю
 * библиотеку. Но осмысленность вида зависит от маршрута: брод, болото и родник
 * важны в лесу и странны посреди города — там они либо декоративные, либо
 * никому не нужны. Поэтому список лежит в данных маршрута полем `poiExclude`, а
 * не в коде.
 *
 * Применяется при добыче и при пересчёте (`--local`), так что в запечённые
 * данные выброшенное не попадает вовсе — заодно и файл подборки легче.
 */
export function applyExclusions(
  pois: RoutePoi[],
  excludedKinds: readonly string[] | undefined,
): RoutePoi[] {
  if (!excludedKinds || excludedKinds.length === 0) return pois
  const excluded = new Set(excludedKinds)
  return pois.filter((poi) => !excluded.has(poi.kind))
}
