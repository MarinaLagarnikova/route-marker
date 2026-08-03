import { create } from 'zustand'
import { storageSet, storageGet, storageRemove } from '@/shared/lib/storage'
import { buildCheckpoints } from '@/entities/checkpoint'
import type { Checkpoint } from '@/entities/checkpoint'
import { applyCheckmark, detectDirection, hashString } from './model'
import type { RouteState, MultiStageMeta, StageMeta } from './model'
import type { LatLon } from '@/shared/lib/geo'
import { cumulativeDistances, isCircularRoute } from '@/shared/lib/geo'
import type { GpxWaypoint, StageGpxData } from '@/shared/lib/gpx'

interface RouteStore {
  route: RouteState | null
  multiStage: MultiStageMeta | null
  loadRoute(name: string, trackPoints: LatLon[], waypoints: GpxWaypoint[], gpxXml: string, trackSegments?: LatLon[][], libraryRouteId?: string): void
  loadSaved(state: RouteState): void
  loadMultiStage(name: string, stages: StageGpxData[], gpxHash: string): void
  loadMultiStageSaved(meta: MultiStageMeta): void
  selectStage(index: number): void
  markCheckpoint(index: number): void
  unmarkLast(): void
  resetProgress(): void
  clearRoute(): void
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  route: null,
  multiStage: null,

  loadRoute(name, trackPoints, waypoints, gpxXml, trackSegments?, libraryRouteId?) {
    const gpxHash = hashString(gpxXml)
    const isCircular = isCircularRoute(trackPoints)
    const dists = cumulativeDistances(trackPoints)
    const totalKm = dists[dists.length - 1]
    const checkpoints = buildCheckpoints(trackPoints, waypoints, isCircular)
    const state: RouteState = {
      name,
      trackPoints,
      trackSegments,
      checkpoints,
      direction: 'forward',
      directionLocked: false,
      gpxHash,
      isCircular,
      circularPhase: 1,
      totalKm,
      originalCheckpoints: isCircular ? checkpoints.map(cp => ({ ...cp })) : undefined,
      originalTrackPoints: isCircular ? [...trackPoints] : undefined,
      originalTrackSegments: isCircular && trackSegments ? trackSegments.map(s => [...s]) : undefined,
      gpxXml,
      libraryRouteId,
    }
    storageSet(gpxHash, state)
    set({ route: state })
  },

  loadSaved(state) {
    set({ route: state })
  },

  loadMultiStage(name, stages, gpxHash) {
    const stagesMeta: StageMeta[] = stages.map((stageData, i) => {
      const stageKey = `${gpxHash}_s${i}`
      const isCircular = isCircularRoute(stageData.trackPoints)
      const dists = cumulativeDistances(stageData.trackPoints)
      const totalKm = dists[dists.length - 1]
      const checkpoints = buildCheckpoints(stageData.trackPoints, stageData.waypoints, isCircular)
      const stageState: RouteState = {
        name: stageData.name,
        trackPoints: stageData.trackPoints,
        trackSegments: stageData.trackSegments,
        checkpoints,
        direction: 'forward',
        directionLocked: false,
        gpxHash: stageKey,
        isCircular,
        circularPhase: 1,
        totalKm,
        originalCheckpoints: isCircular ? checkpoints.map((cp) => ({ ...cp })) : undefined,
        originalTrackPoints: isCircular ? [...stageData.trackPoints] : undefined,
        originalTrackSegments: isCircular && stageData.trackSegments ? stageData.trackSegments.map((s) => [...s]) : undefined,
      }
      storageSet(stageKey, stageState)
      return { name: stageData.name, stageKey, totalKm }
    })

    const meta: MultiStageMeta = { name, gpxHash, stages: stagesMeta }
    storageSet(`multi_${gpxHash}`, meta)
    set({ multiStage: meta })
  },

  loadMultiStageSaved(meta) {
    set({ multiStage: meta })
  },

  selectStage(index) {
    const { multiStage } = get()
    if (!multiStage) return
    const stageMeta = multiStage.stages[index]
    if (!stageMeta) return
    const stageState = storageGet<RouteState>(stageMeta.stageKey)
    if (!stageState) return
    set({ route: stageState })
  },

  markCheckpoint(index) {
    const { route } = get()
    if (!route) return
    const now = Date.now()

    if (route.isCircular) {
      _markCircular(route, index, now, set)
    } else {
      _markLinear(route, index, now, set)
    }
  },

  unmarkLast() {
    const { route } = get()
    if (!route) return

    // Circular phase 2: unmarking P (the only checked point) → restore to phase 1
    if (route.isCircular && route.circularPhase === 2) {
      // Guard: if snapshots missing (old persisted state), fall back to normal unmark
      if (!route.originalTrackPoints || !route.originalCheckpoints) {
        // just unmark the last checkpoint normally
      } else {
        const next: RouteState = {
          ...route,
          trackPoints: route.originalTrackPoints,
          checkpoints: route.originalCheckpoints,
          circularPhase: 1,
        }
        storageSet(route.gpxHash, next)
        set({ route: next })
        return
      }
    }

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

    if (route.isCircular) {
      if (!route.originalCheckpoints || !route.originalTrackPoints) {
        // corrupted state: just clear checkedAt and go back to phase 1
        const updated = route.checkpoints.map((cp) => ({ ...cp, checkedAt: undefined }))
        const next: RouteState = {
          ...route,
          checkpoints: updated,
          direction: 'forward',
          directionLocked: false,
          circularPhase: 1,
        }
        storageSet(route.gpxHash, next)
        set({ route: next })
        return
      }
      // Restore to original (phase 1)
      const updated = route.originalCheckpoints.map((cp) => ({ ...cp, checkedAt: undefined }))
      const next: RouteState = {
        ...route,
        trackPoints: route.originalTrackPoints,
        checkpoints: updated,
        direction: 'forward',
        directionLocked: false,
        circularPhase: 1,
      }
      storageSet(route.gpxHash, next)
      set({ route: next })
      return
    }

    let { trackPoints, checkpoints } = route
    let trackSegments = route.trackSegments
    if (route.direction === 'reverse') {
      const n = trackPoints.length
      const totalKm = checkpoints[checkpoints.length - 1].distanceKm
      trackPoints = [...trackPoints].reverse()
      checkpoints = [...checkpoints].reverse().map((cp) => ({
        ...cp,
        distanceKm: totalKm - cp.distanceKm,
        trackIndex: n - 1 - cp.trackIndex,
      }))
      if (trackSegments) {
        trackSegments = [...trackSegments].reverse().map((s) => s.slice().reverse())
      }
    }

    const updated = checkpoints.map((cp) => ({ ...cp, checkedAt: undefined }))
    const next: RouteState = {
      ...route,
      trackPoints,
      trackSegments,
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

// ─── Linear marking ───────────────────────────────────────────────────────────

function _markLinear(
  route: RouteState,
  index: number,
  now: number,
  set: (partial: { route: RouteState }) => void
) {
  let { checkpoints, direction, directionLocked } = route
  let trackPoints = route.trackPoints
  let trackSegments = route.trackSegments
  let resolvedIndex = index

  if (!directionLocked) {
    direction = detectDirection(checkpoints, index, checkpoints.length)
    directionLocked = true

    if (direction === 'reverse') {
      const totalKm = checkpoints[checkpoints.length - 1].distanceKm
      const n = trackPoints.length
      trackPoints = [...trackPoints].reverse()
      checkpoints = [...checkpoints].reverse().map((cp) => ({
        ...cp,
        distanceKm: totalKm - cp.distanceKm,
        trackIndex: n - 1 - cp.trackIndex,
      }))
      resolvedIndex = checkpoints.length - 1 - index
      if (route.trackSegments) {
        trackSegments = [...route.trackSegments].reverse().map((s) => s.slice().reverse())
      }
    }
  }

  const updated = applyCheckmark(checkpoints, resolvedIndex, now)
  const next: RouteState = { ...route, trackPoints, trackSegments, checkpoints: updated, direction, directionLocked }
  storageSet(route.gpxHash, next)
  set({ route: next })
}

// ─── Circular marking (three phases) ─────────────────────────────────────────

function _markCircular(
  route: RouteState,
  index: number,
  now: number,
  set: (partial: { route: RouteState }) => void
) {
  const { checkpoints, totalKm, circularPhase } = route

  if (circularPhase === 1) {
    // Phase 1 → 2: P becomes Старт
    const p = checkpoints[index]
    const pDist = p.distanceKm
    const n = route.trackPoints.length
    const pTrackIdx = p.trackIndex

    // Rotate checkpoints: [P_start, ...after_P, ...before_P, P_finish]
    const afterP = checkpoints.slice(index + 1)
    const beforeP = checkpoints.slice(0, index)
    const middle = [...afterP, ...beforeP].map((cp) => ({
      ...cp,
      distanceKm:
        cp.distanceKm > pDist
          ? cp.distanceKm - pDist
          : totalKm - pDist + cp.distanceKm,
    }))

    const pStart: Checkpoint = {
      ...p,
      id: 'cp_ring_start',
      name: 'Старт',
      distanceKm: 0,
      trackIndex: 0,
      checkedAt: now,
    }
    const pFinish: Checkpoint = {
      ...p,
      id: 'cp_ring_finish',
      name: 'Финиш',
      distanceKm: totalKm,
      trackIndex: n - 1,
      checkedAt: undefined,
    }

    // Rotate trackPoints so P is at index 0
    const rotatedTrack: LatLon[] = [
      ...route.trackPoints.slice(pTrackIdx),
      ...route.trackPoints.slice(0, pTrackIdx),
    ]

    // Recalculate trackIndex in middle checkpoints relative to rotated track
    const rotatedMiddle = middle.map((cp) => ({
      ...cp,
      trackIndex:
        cp.trackIndex >= pTrackIdx
          ? cp.trackIndex - pTrackIdx
          : n - pTrackIdx + cp.trackIndex,
    }))

    const newCheckpoints = [pStart, ...rotatedMiddle, pFinish]
    const next: RouteState = {
      ...route,
      trackPoints: rotatedTrack,
      checkpoints: newCheckpoints,
      circularPhase: 2,
    }
    storageSet(route.gpxHash, next)
    set({ route: next })

  } else if (circularPhase === 2) {
    // Phase 2 → 3: Q fixes direction
    const q = checkpoints[index]
    const arcCW = q.distanceKm  // distance P→Q going CW (current order)
    const arcCCW = totalKm - arcCW

    let finalCheckpoints: Checkpoint[]
    let finalTrackPoints = route.trackPoints

    if (arcCCW < arcCW) {
      // Shorter path is CCW → reverse middle, reverse trackPoints
      const pStart = checkpoints[0]
      const pFinish = checkpoints[checkpoints.length - 1]
      const middle = checkpoints.slice(1, -1).reverse()
      const n = route.trackPoints.length

      // Recalculate distances and trackIndex for reversed direction
      const reversedMiddle = middle.map((cp) => ({
        ...cp,
        distanceKm: totalKm - cp.distanceKm,
        trackIndex: n - 1 - cp.trackIndex,
      }))
      finalCheckpoints = [
        pStart,
        ...reversedMiddle,
        { ...pFinish, trackIndex: n - 1 },
      ]
      finalTrackPoints = [...route.trackPoints].reverse()
    } else {
      finalCheckpoints = [...checkpoints]
    }

    // Find Q's index in final list (by id)
    const qNewIdx = finalCheckpoints.findIndex((cp) => cp.id === q.id)
    const updated = applyCheckmark(finalCheckpoints, qNewIdx, now)

    const next: RouteState = {
      ...route,
      trackPoints: finalTrackPoints,
      checkpoints: updated,
      circularPhase: 3,
      directionLocked: true,
    }
    storageSet(route.gpxHash, next)
    set({ route: next })

  } else {
    // Phase 3: normal rules
    const updated = applyCheckmark(checkpoints, index, now)
    const next: RouteState = { ...route, checkpoints: updated }
    storageSet(route.gpxHash, next)
    set({ route: next })
  }
}
