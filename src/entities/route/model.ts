import type { Checkpoint } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'

export type Direction = 'forward' | 'reverse'

export interface RouteState {
  name: string
  trackPoints: LatLon[]
  checkpoints: Checkpoint[]
  direction: Direction
  directionLocked: boolean
  gpxHash: string
}

export function detectDirection(
  checkpoints: Checkpoint[],
  markedIndex: number,
  totalCheckpoints: number
): Direction {
  return markedIndex >= totalCheckpoints / 2 ? 'reverse' : 'forward'
}

export function applyCheckmark(
  checkpoints: Checkpoint[],
  targetIndex: number,
  timestamp: number
): Checkpoint[] {
  return checkpoints.map((cp, i) =>
    i <= targetIndex && cp.checkedAt === undefined ? { ...cp, checkedAt: timestamp } : cp
  )
}

export function computeFinishForecast(checkpoints: Checkpoint[]): number | null {
  const checked = checkpoints.filter((cp) => cp.checkedAt !== undefined)
  if (checked.length < 2) return null

  const first = checked[0]
  const last = checked[checked.length - 1]
  const elapsed = last.checkedAt! - first.checkedAt!
  if (elapsed <= 0) return null

  const coveredKm = last.distanceKm - first.distanceKm
  if (coveredKm <= 0) return null

  const remainingKm = checkpoints[checkpoints.length - 1].distanceKm - last.distanceKm
  const pace = elapsed / coveredKm
  return last.checkedAt! + remainingKm * pace
}

export function hashString(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16)
}
