import type { RouteState } from './model'
import { computeFinishForecast } from './model'

export function selectCoveredKm(route: RouteState): number {
  const checked = route.checkpoints.filter((cp) => cp.checkedAt !== undefined)
  if (!checked.length) return 0
  return checked[checked.length - 1].distanceKm
}

export function selectRemainingKm(route: RouteState): number {
  const total = route.checkpoints[route.checkpoints.length - 1]?.distanceKm ?? 0
  return Math.max(0, total - selectCoveredKm(route))
}

export function selectTotalKm(route: RouteState): number {
  return route.checkpoints[route.checkpoints.length - 1]?.distanceKm ?? 0
}

export function selectFinishForecast(route: RouteState): number | null {
  return computeFinishForecast(route.checkpoints)
}
