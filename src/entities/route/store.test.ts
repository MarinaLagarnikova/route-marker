import { describe, it, expect, beforeEach } from 'vitest'
import { useRouteStore } from './store'

// Small circular track: square ring, each side ~0.8km
// track[0] and track[last] are ~74m apart (clearly circular)
const circularTrack = [
  { lat: 55.000, lon: 37.000 },
  { lat: 55.007, lon: 37.000 },
  { lat: 55.007, lon: 37.012 },
  { lat: 55.000, lon: 37.012 },
  { lat: 55.000, lon: 37.001 }, // ~74m from start → circular
]

// Waypoints close to track points (within 0.05km)
const waypoints = [
  { lat: 55.007, lon: 37.001, name: 'КТ 1' },
  { lat: 55.007, lon: 37.011, name: 'КТ 2' },
  { lat: 55.001, lon: 37.012, name: 'КТ 3' },
]

function loadCircular() {
  useRouteStore.getState().loadRoute('Кольцо', circularTrack, waypoints, '<gpx/>')
}

beforeEach(() => {
  useRouteStore.setState({ route: null })
})

// ─── Loading ───────────────────────────────────────────────────────────────────

describe('loadRoute — circular detection', () => {
  it('detects circular route', () => {
    loadCircular()
    const { route } = useRouteStore.getState()
    expect(route?.isCircular).toBe(true)
  })

  it('starts in phase 1', () => {
    loadCircular()
    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(1)
  })

  it('totalKm > 0', () => {
    loadCircular()
    const { route } = useRouteStore.getState()
    expect(route?.totalKm).toBeGreaterThan(0)
  })

  it('snapshots originalCheckpoints matching checkpoints', () => {
    loadCircular()
    const r = useRouteStore.getState().route!
    expect(r.originalCheckpoints).toHaveLength(r.checkpoints.length)
  })

  it('snapshots originalTrackPoints matching trackPoints', () => {
    loadCircular()
    const r = useRouteStore.getState().route!
    expect(r.originalTrackPoints).toHaveLength(r.trackPoints.length)
  })

  it('phase 1 checkpoints have no checkedAt', () => {
    loadCircular()
    const r = useRouteStore.getState().route!
    expect(r.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })
})

// ─── Phase 1 → 2 ──────────────────────────────────────────────────────────────

describe('phase 1 → 2 (first mark)', () => {
  beforeEach(() => {
    loadCircular()
    // Mark the first waypoint (index 0) to trigger phase 1 → 2
    useRouteStore.getState().markCheckpoint(0)
  })

  it('moves to phase 2', () => {
    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(2)
  })

  it('first checkpoint becomes Старт at km 0', () => {
    const { route } = useRouteStore.getState()
    const first = route!.checkpoints[0]
    expect(first.name).toBe('Старт')
    expect(first.distanceKm).toBe(0)
  })

  it('virtual Финиш at end with distanceKm === totalKm', () => {
    const { route } = useRouteStore.getState()
    const last = route!.checkpoints[route!.checkpoints.length - 1]
    expect(last.name).toBe('Финиш')
    expect(last.distanceKm).toBeCloseTo(route!.totalKm, 5)
  })

  it('Старт has checkedAt set', () => {
    const { route } = useRouteStore.getState()
    expect(route!.checkpoints[0].checkedAt).toBeDefined()
  })

  it('middle checkpoints have distanceKm > 0', () => {
    const { route } = useRouteStore.getState()
    const cps = route!.checkpoints
    // All middle points (not Старт) should have distanceKm > 0
    for (let i = 1; i < cps.length; i++) {
      expect(cps[i].distanceKm).toBeGreaterThan(0)
    }
  })

  it('has more checkpoints than in phase 1 (added Финиш)', () => {
    loadCircular()
    const phase1Count = useRouteStore.getState().route!.checkpoints.length
    useRouteStore.getState().markCheckpoint(0)
    const phase2Count = useRouteStore.getState().route!.checkpoints.length
    // Phase 2: [Старт, ...middle, Финиш] = original + 1 (Финиш added)
    expect(phase2Count).toBe(phase1Count + 1)
  })
})

// ─── Unmark in phase 2 ────────────────────────────────────────────────────────

describe('unmarkLast in phase 2', () => {
  beforeEach(() => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    // Verify we're in phase 2 before unmarking
    expect(useRouteStore.getState().route?.circularPhase).toBe(2)
    useRouteStore.getState().unmarkLast()
  })

  it('returns to phase 1', () => {
    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(1)
  })

  it('restores original checkpoint count', () => {
    loadCircular()
    const originalCount = useRouteStore.getState().route!.checkpoints.length

    useRouteStore.setState({ route: null })
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().unmarkLast()

    const restoredCount = useRouteStore.getState().route!.checkpoints.length
    expect(restoredCount).toBe(originalCount)
  })

  it('all checkpoints have no checkedAt', () => {
    const { route } = useRouteStore.getState()
    expect(route!.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })
})

// ─── Phase 2 → 3 ──────────────────────────────────────────────────────────────

describe('phase 2 → 3 (second mark)', () => {
  beforeEach(() => {
    loadCircular()
    // Phase 1 → 2: mark first checkpoint
    useRouteStore.getState().markCheckpoint(0)
    // Phase 2 → 3: mark next checkpoint (index 1, which is Q)
    useRouteStore.getState().markCheckpoint(1)
  })

  it('moves to phase 3', () => {
    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(3)
  })

  it('Старт and Q are both checked', () => {
    const { route } = useRouteStore.getState()
    const checkedCount = route!.checkpoints.filter((cp) => cp.checkedAt !== undefined).length
    // Старт (index 0) + Q (index 1) should both be marked
    expect(checkedCount).toBeGreaterThanOrEqual(2)
    expect(route!.checkpoints[0].checkedAt).toBeDefined()
    expect(route!.checkpoints[1].checkedAt).toBeDefined()
  })

  it('directionLocked is true after phase 3', () => {
    const { route } = useRouteStore.getState()
    expect(route?.directionLocked).toBe(true)
  })
})

// ─── Phase 2 → 3 CCW reversal ─────────────────────────────────────────────────

describe('phase 2 → 3 CCW reversal', () => {
  it('CCW path: checkpoints are reversed when second mark is past halfway', () => {
    loadCircular()
    // Enter phase 2 by marking КТ 1 (index 0 in phase 1)
    useRouteStore.getState().markCheckpoint(0)
    const phase2 = useRouteStore.getState().route!

    // In phase 2, checkpoints are [Старт(0), КТ 2(~cw-short), КТ 3(~cw-long), Финиш(totalKm)]
    // КТ 3 is near track[3] which is ~3/4 of the ring from P (КТ 1 near track[1])
    // → arcCW(КТ 3) > totalKm/2, so arcCCW < arcCW → CCW branch fires
    const kt3Idx = 2 // index of КТ 3 in phase-2 checkpoints
    const kt3 = phase2.checkpoints[kt3Idx]

    // Verify fixture produces the expected CCW case before asserting
    expect(kt3.distanceKm).toBeGreaterThan(phase2.totalKm / 2)

    const phase2Dist = kt3.distanceKm
    useRouteStore.getState().markCheckpoint(kt3Idx)
    const r = useRouteStore.getState().route!

    // Should have transitioned to phase 3
    expect(r.circularPhase).toBe(3)
    // Direction is locked
    expect(r.directionLocked).toBe(true)
    // Старт (index 0) should still be checked
    expect(r.checkpoints[0].checkedAt).toBeDefined()
    // After CCW reversal, КТ 3 is re-indexed; its new distance = totalKm - phase2Dist
    const qInFinal = r.checkpoints.find((cp) => cp.id === kt3.id)
    expect(qInFinal).toBeDefined()
    expect(qInFinal!.distanceKm).toBeCloseTo(phase2.totalKm - phase2Dist, 1)
    expect(qInFinal!.checkedAt).toBeDefined()
  })
})

// ─── Phase 3 normal marking ───────────────────────────────────────────────────

describe('phase 3 — normal rules', () => {
  beforeEach(() => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0) // → phase 2
    useRouteStore.getState().markCheckpoint(1) // → phase 3
  })

  it('marks next checkpoint after Q', () => {
    const beforeCount = useRouteStore
      .getState()
      .route!.checkpoints.filter((cp) => cp.checkedAt !== undefined).length

    // Mark the next checkpoint (index 2)
    useRouteStore.getState().markCheckpoint(2)

    const afterCount = useRouteStore
      .getState()
      .route!.checkpoints.filter((cp) => cp.checkedAt !== undefined).length

    expect(afterCount).toBeGreaterThan(beforeCount)
    expect(useRouteStore.getState().route!.checkpoints[2].checkedAt).toBeDefined()
  })

  it('stays in phase 3 after additional marks', () => {
    useRouteStore.getState().markCheckpoint(2)
    expect(useRouteStore.getState().route?.circularPhase).toBe(3)
  })
})

// ─── Reset ────────────────────────────────────────────────────────────────────

describe('resetProgress', () => {
  it('restores phase 1 with no marks (from phase 2)', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0) // → phase 2
    useRouteStore.getState().resetProgress()

    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(1)
    expect(route!.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })

  it('restores phase 1 with no marks (from phase 3)', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0) // → phase 2
    useRouteStore.getState().markCheckpoint(1) // → phase 3
    useRouteStore.getState().markCheckpoint(2)
    useRouteStore.getState().resetProgress()

    const { route } = useRouteStore.getState()
    expect(route?.circularPhase).toBe(1)
    expect(route!.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })

  it('restores original checkpoint count', () => {
    loadCircular()
    const originalCount = useRouteStore.getState().route!.checkpoints.length

    useRouteStore.getState().markCheckpoint(0) // → phase 2 (count changes)
    useRouteStore.getState().resetProgress()

    const restoredCount = useRouteStore.getState().route!.checkpoints.length
    expect(restoredCount).toBe(originalCount)
  })

  it('direction is reset to forward', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().markCheckpoint(1)
    useRouteStore.getState().resetProgress()

    const { route } = useRouteStore.getState()
    expect(route?.direction).toBe('forward')
    expect(route?.directionLocked).toBe(false)
  })
})
