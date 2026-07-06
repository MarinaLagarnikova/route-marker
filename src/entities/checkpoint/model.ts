import { cumulativeDistances, projectWptOnTrack, haversineKm } from '@/shared/lib/geo'
import type { LatLon } from '@/shared/lib/geo'
import type { GpxWaypoint } from '@/shared/lib/gpx'
import { AUTO_CHECKPOINT_INTERVAL_KM, MIN_CHECKPOINTS_BEFORE_AUTO } from '@/shared/config'

export interface Checkpoint {
  id: string
  name: string
  lat: number
  lon: number
  trackIndex: number
  distanceKm: number
  checkedAt?: number
}

export function buildCheckpoints(
  track: LatLon[],
  waypoints: GpxWaypoint[],
  isCircular = false
): Checkpoint[] {
  const dists = cumulativeDistances(track)
  const totalKm = dists[dists.length - 1]

  const rawWpts: GpxWaypoint[] =
    waypoints.length >= MIN_CHECKPOINTS_BEFORE_AUTO
      ? waypoints
      : generateAutoWaypoints(track, dists, totalKm)

  const MAX_DIST_FROM_TRACK_KM = 0.5

  const projected = rawWpts
    .map((w) => {
      const idx = projectWptOnTrack(w, track)
      const distFromTrack = haversineKm(w, track[idx])
      return { ...w, trackIndex: idx, distanceKm: dists[idx], distFromTrack }
    })
    .filter((w) => w.distFromTrack <= MAX_DIST_FROM_TRACK_KM)
  projected.sort((a, b) => a.trackIndex - b.trackIndex)

  if (isCircular) {
    return projected.map((cp, i) => ({ ...cp, id: `cp_${i}` }))
  }

  const start = {
    name: 'Старт',
    lat: track[0].lat,
    lon: track[0].lon,
    trackIndex: 0,
    distanceKm: 0,
  }
  const finish = {
    name: 'Финиш',
    lat: track[track.length - 1].lat,
    lon: track[track.length - 1].lon,
    trackIndex: track.length - 1,
    distanceKm: totalKm,
  }

  const DEDUP_KM = 0.05
  const middle = projected.filter(
    (p) =>
      haversineKm(p, track[0]) > DEDUP_KM &&
      haversineKm(p, track[track.length - 1]) > DEDUP_KM
  )

  return [start, ...middle, finish].map((cp, i) => ({ ...cp, id: `cp_${i}` }))
}

function generateAutoWaypoints(
  track: LatLon[],
  dists: number[],
  totalKm: number
): GpxWaypoint[] {
  const result: GpxWaypoint[] = []
  let next = AUTO_CHECKPOINT_INTERVAL_KM
  let count = 1
  for (let i = 0; i < track.length; i++) {
    if (dists[i] >= next) {
      result.push({ ...track[i], name: `КТ ${count}` })
      count++
      next += AUTO_CHECKPOINT_INTERVAL_KM
      if (next >= totalKm) break
    }
  }
  return result
}

export function getLastChecked(checkpoints: Checkpoint[]): number {
  let last = -1
  for (let i = 0; i < checkpoints.length; i++) {
    if (checkpoints[i].checkedAt !== undefined) last = i
  }
  return last
}

export function canUncheck(checkpoints: Checkpoint[], index: number): boolean {
  return getLastChecked(checkpoints) === index
}
