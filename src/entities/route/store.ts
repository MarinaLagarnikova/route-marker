import { create } from 'zustand'
import { storageGet, storageSet, storageRemove } from '@/shared/lib/storage'
import { buildCheckpoints } from '@/entities/checkpoint'
import type { Checkpoint } from '@/entities/checkpoint'
import { applyCheckmark, detectDirection, hashString } from './model'
import type { Direction, RouteState } from './model'
import type { LatLon } from '@/shared/lib/geo'
import type { GpxWaypoint } from '@/shared/lib/gpx'

interface RouteStore {
  route: RouteState | null
  loadRoute(name: string, trackPoints: LatLon[], waypoints: GpxWaypoint[], gpxXml: string): void
  loadSaved(state: RouteState): void
  markCheckpoint(index: number): void
  unmarkLast(): void
  resetProgress(): void
  clearRoute(): void
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  route: null,

  loadRoute(name, trackPoints, waypoints, gpxXml) {
    const gpxHash = hashString(gpxXml)
    const checkpoints = buildCheckpoints(trackPoints, waypoints)
    const state: RouteState = {
      name,
      trackPoints,
      checkpoints,
      direction: 'forward',
      directionLocked: false,
      gpxHash,
    }
    storageSet(gpxHash, state)
    set({ route: state })
  },

  loadSaved(state) {
    set({ route: state })
  },

  markCheckpoint(index) {
    const { route } = get()
    if (!route) return

    const now = Date.now()
    let { checkpoints, direction, directionLocked } = route

    if (!directionLocked) {
      direction = detectDirection(checkpoints, index, checkpoints.length)
      directionLocked = true

      if (direction === 'reverse') {
        const totalKm = checkpoints[checkpoints.length - 1].distanceKm
        checkpoints = [...checkpoints].reverse().map((cp) => ({
          ...cp,
          distanceKm: totalKm - cp.distanceKm,
        }))
      }
    }

    const updated = applyCheckmark(checkpoints, index, now)
    const next: RouteState = { ...route, checkpoints: updated, direction, directionLocked }
    storageSet(route.gpxHash, next)
    set({ route: next })
  },

  unmarkLast() {
    const { route } = get()
    if (!route) return
    const { checkpoints } = route
    const lastIdx = [...checkpoints].reverse().findIndex((cp) => cp.checkedAt !== undefined)
    if (lastIdx === -1) return
    const realIdx = checkpoints.length - 1 - lastIdx
    const updated: Checkpoint[] = checkpoints.map((cp, i) =>
      i === realIdx ? { ...cp, checkedAt: undefined } : cp
    )
    const next: RouteState = { ...route, checkpoints: updated }
    storageSet(route.gpxHash, next)
    set({ route: next })
  },

  resetProgress() {
    const { route } = get()
    if (!route) return
    const updated = route.checkpoints.map((cp) => ({ ...cp, checkedAt: undefined }))
    const next: RouteState = {
      ...route,
      checkpoints: updated,
      direction: 'forward',
      directionLocked: false,
    }
    storageSet(route.gpxHash, next)
    set({ route: next })
  },

  clearRoute() {
    const { route } = get()
    if (route) storageRemove(route.gpxHash)
    set({ route: null })
  },
}))
