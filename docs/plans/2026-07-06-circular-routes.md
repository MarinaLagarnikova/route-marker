# Circular Routes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Поддержка кольцевых маршрутов с тремя фазами: выбор старта → фиксация направления → нормальный режим.

**Architecture:** Обнаружение кольца происходит при парсинге (`isCircularRoute` в geo). Стор управляет тремя фазами через `circularPhase: 1|2|3` — каждая фаза меняет логику `markCheckpoint`. Виджеты читают фазу из стора и меняют отображение: номера, кнопки, карту.

**Tech Stack:** React 18, TypeScript strict, Zustand, Vitest, Tailwind CSS

---

## Решённые дизайн-решения

| Вопрос | Решение |
|--------|---------|
| Нумерация | Нет в фазе 1/2; есть в фазе 3 |
| Кнопка «История» | Задизейблена в фазе 1/2 |
| Отмена P в фазе 2 | Можно — возврат в фазу 1 |
| P в списке | Два отдельных Checkpoint (`cp_ring_start` / `cp_ring_finish`) |
| Закрашивание трека | Только в фазе 3 |
| «Здесь» в фазе 1/2 | На ВСЕХ непройденных (любую можно отметить) |

---

## Task 1: `isCircularRoute` — geo helper + тест

**Files:**
- Modify: `src/shared/lib/geo/index.ts`
- Modify: `src/shared/lib/geo/geo.test.ts`

**Step 1: Write failing test**

Добавить в `geo.test.ts`:

```typescript
describe('isCircularRoute', () => {
  it('returns false for linear track', () => {
    const track = [{ lat: 55.0, lon: 37.0 }, { lat: 55.5, lon: 37.5 }, { lat: 56.0, lon: 38.0 }]
    expect(isCircularRoute(track)).toBe(false)
  })

  it('returns true when first and last points within 200m', () => {
    // ~180m apart
    const track = [
      { lat: 55.750000, lon: 37.610000 },
      { lat: 55.755000, lon: 37.620000 },
      { lat: 55.760000, lon: 37.610000 },
      { lat: 55.750016, lon: 37.610010 }, // ~1.8m from start
    ]
    expect(isCircularRoute(track)).toBe(true)
  })

  it('returns true when gap < 2% of total length even if > 200m', () => {
    // Long route (1000km) where endpoints are 5km apart (< 2%)
    // We test the threshold logic, not exact geo values
    // Build track: go 500km east, then 500km back but not quite
    const pts: Array<{lat: number; lon: number}> = []
    for (let i = 0; i <= 100; i++) pts.push({ lat: 55.0, lon: 37.0 + i * 0.05 }) // ~3.5km each step
    // Move last point slightly away from first but within 2% of total
    pts.push({ lat: 55.0 + 0.002, lon: 37.0 }) // ~220m from start, but route is ~350km total => 0.06%
    expect(isCircularRoute(pts)).toBe(true)
  })

  it('returns false for short track with far endpoints', () => {
    const track = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.5, lon: 38.0 }, // far from start
    ]
    expect(isCircularRoute(track)).toBe(false)
  })
})
```

**Step 2: Run test — ожидаем FAIL**
```
npx vitest run src/shared/lib/geo/geo.test.ts
```

**Step 3: Implement**

Добавить в `src/shared/lib/geo/index.ts`:

```typescript
export function isCircularRoute(track: LatLon[]): boolean {
  if (track.length < 3) return false
  const dists = cumulativeDistances(track)
  const totalKm = dists[dists.length - 1]
  const gapKm = haversineKm(track[0], track[track.length - 1])
  const threshold = Math.max(0.2, totalKm * 0.02)
  return gapKm <= threshold
}
```

**Step 4: Run test — ожидаем PASS**
```
npx vitest run src/shared/lib/geo/geo.test.ts
```

**Step 5: Commit**
```bash
git add src/shared/lib/geo/index.ts src/shared/lib/geo/geo.test.ts
git commit -m "feat: add isCircularRoute geo helper"
```

---

## Task 2: Обновить `RouteState` — добавить поля для кольца

**Files:**
- Modify: `src/entities/route/model.ts`
- Modify: `src/entities/route/index.ts`

**Step 1: Обновить `model.ts`**

Заменить весь файл:

```typescript
import type { Checkpoint } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'

export type Direction = 'forward' | 'reverse'
export type CircularPhase = 1 | 2 | 3

export interface RouteState {
  name: string
  trackPoints: LatLon[]
  checkpoints: Checkpoint[]
  direction: Direction
  directionLocked: boolean
  gpxHash: string
  isCircular: boolean
  circularPhase: CircularPhase
  totalKm: number
  /** Snapshot of checkpoints before circular rotation — used for reset */
  originalCheckpoints?: Checkpoint[]
  /** Snapshot of trackPoints before circular rotation — used for reset */
  originalTrackPoints?: LatLon[]
}

export function detectDirection(
  _checkpoints: Checkpoint[],
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
```

**Step 2: Экспортировать `CircularPhase` из `index.ts`**

Добавить в `src/entities/route/index.ts`:
```typescript
export type { RouteState, Direction, CircularPhase } from './model'
```
(заменить существующую строку с `Direction`)

**Step 3: Commit**
```bash
git add src/entities/route/model.ts src/entities/route/index.ts
git commit -m "feat: add circular route fields to RouteState"
```

---

## Task 3: Обновить `buildCheckpoints` для кольца

**Files:**
- Modify: `src/entities/checkpoint/model.ts`

**Step 1: Write failing test**

Добавить describe в `src/entities/checkpoint/model.test.ts` (создать если нет):

```typescript
import { describe, it, expect } from 'vitest'
import { buildCheckpoints } from './model'

describe('buildCheckpoints — circular', () => {
  // Minimal circular track: 6 points forming approximate ring
  const circularTrack = [
    { lat: 55.000, lon: 37.000 },
    { lat: 55.005, lon: 37.010 },
    { lat: 55.010, lon: 37.000 },
    { lat: 55.005, lon: 36.990 },
    { lat: 55.001, lon: 36.999 }, // close to start
  ]
  const waypoints = [
    { lat: 55.005, lon: 37.010, name: 'КТ А' },
    { lat: 55.010, lon: 37.000, name: 'КТ Б' },
    { lat: 55.005, lon: 36.990, name: 'КТ В' },
  ]

  it('circular: does NOT add forced Старт/Финиш', () => {
    const cps = buildCheckpoints(circularTrack, waypoints, true)
    expect(cps.find(cp => cp.name === 'Старт')).toBeUndefined()
    expect(cps.find(cp => cp.name === 'Финиш')).toBeUndefined()
  })

  it('circular: returns wpts from file when >= MIN_CHECKPOINTS_BEFORE_AUTO', () => {
    const cps = buildCheckpoints(circularTrack, waypoints, true)
    expect(cps.length).toBeGreaterThanOrEqual(3)
  })

  it('linear: still adds Старт and Финиш', () => {
    const linearTrack = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.2, lon: 37.2 },
    ]
    const cps = buildCheckpoints(linearTrack, [], false)
    expect(cps[0].name).toBe('Старт')
    expect(cps[cps.length - 1].name).toBe('Финиш')
  })
})
```

**Step 2: Run test — ожидаем FAIL**
```
npx vitest run src/entities/checkpoint/model.test.ts
```

**Step 3: Implement**

В `src/entities/checkpoint/model.ts` обновить сигнатуру `buildCheckpoints` и логику:

```typescript
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
    // No forced Старт/Финиш — any point can become the start
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
```

**Step 4: Run test — ожидаем PASS**
```
npx vitest run src/entities/checkpoint/model.test.ts
```

**Step 5: Commit**
```bash
git add src/entities/checkpoint/model.ts src/entities/checkpoint/model.test.ts
git commit -m "feat: buildCheckpoints skips forced start/finish for circular routes"
```

---

## Task 4: Обновить стор — `loadRoute` + `resetProgress`

**Files:**
- Modify: `src/entities/route/store.ts`

**Step 1: Implement `loadRoute` и `resetProgress` для кольца**

Полный новый `store.ts`:

```typescript
import { create } from 'zustand'
import { storageSet, storageRemove } from '@/shared/lib/storage'
import { buildCheckpoints } from '@/entities/checkpoint'
import type { Checkpoint } from '@/entities/checkpoint'
import { applyCheckmark, detectDirection, hashString } from './model'
import type { RouteState } from './model'
import type { LatLon } from '@/shared/lib/geo'
import { cumulativeDistances, isCircularRoute } from '@/shared/lib/geo'
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
    const isCircular = isCircularRoute(trackPoints)
    const dists = cumulativeDistances(trackPoints)
    const totalKm = dists[dists.length - 1]
    const checkpoints = buildCheckpoints(trackPoints, waypoints, isCircular)
    const state: RouteState = {
      name,
      trackPoints,
      checkpoints,
      direction: 'forward',
      directionLocked: false,
      gpxHash,
      isCircular,
      circularPhase: 1,
      totalKm,
      originalCheckpoints: isCircular ? checkpoints : undefined,
      originalTrackPoints: isCircular ? [...trackPoints] : undefined,
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
      const next: RouteState = {
        ...route,
        trackPoints: route.originalTrackPoints!,
        checkpoints: route.originalCheckpoints!,
        circularPhase: 1,
      }
      storageSet(route.gpxHash, next)
      set({ route: next })
      return
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
      // Restore to original (phase 1)
      const updated = route.originalCheckpoints!.map((cp) => ({ ...cp, checkedAt: undefined }))
      const next: RouteState = {
        ...route,
        trackPoints: route.originalTrackPoints!,
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
    if (route.direction === 'reverse') {
      const n = trackPoints.length
      const totalKm = checkpoints[checkpoints.length - 1].distanceKm
      trackPoints = [...trackPoints].reverse()
      checkpoints = [...checkpoints].reverse().map((cp) => ({
        ...cp,
        distanceKm: totalKm - cp.distanceKm,
        trackIndex: n - 1 - cp.trackIndex,
      }))
    }

    const updated = checkpoints.map((cp) => ({ ...cp, checkedAt: undefined }))
    const next: RouteState = {
      ...route,
      trackPoints,
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

// ─── Linear marking (existing logic, extracted) ───────────────────────────────

function _markLinear(
  route: RouteState,
  index: number,
  now: number,
  set: (partial: { route: RouteState }) => void
) {
  let { checkpoints, direction, directionLocked } = route
  let trackPoints = route.trackPoints
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
    }
  }

  const updated = applyCheckmark(checkpoints, resolvedIndex, now)
  const next: RouteState = { ...route, trackPoints, checkpoints: updated, direction, directionLocked }
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
      distanceKm: cp.distanceKm > pDist
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
      trackIndex: cp.trackIndex >= pTrackIdx
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
      // pStart trackIndex stays 0, pFinish stays n-1 (correct after reverse)
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
```

**Step 2: Проверяем что TypeScript компилируется**
```
npx tsc --noEmit
```
Исправить любые ошибки типов.

**Step 3: Commit**
```bash
git add src/entities/route/store.ts
git commit -m "feat: circular route store logic — three-phase markCheckpoint"
```

---

## Task 5: Тесты для store — круговые фазы

**Files:**
- Create: `src/entities/route/store.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useRouteStore } from './store'

// Minimal circular track: square ring ~1.5km per side
const circularTrack = [
  { lat: 55.000, lon: 37.000 },
  { lat: 55.000, lon: 37.020 },
  { lat: 55.010, lon: 37.020 },
  { lat: 55.010, lon: 37.000 },
  { lat: 55.001, lon: 36.999 }, // close to start (~150m)
]
const waypoints = [
  { lat: 55.000, lon: 37.020, name: 'КТ 1' },
  { lat: 55.010, lon: 37.020, name: 'КТ 2' },
  { lat: 55.010, lon: 37.000, name: 'КТ 3' },
]

function loadCircular() {
  useRouteStore.getState().loadRoute('Кольцо', circularTrack, waypoints, '<gpx/>')
}

beforeEach(() => {
  useRouteStore.setState({ route: null })
})

describe('circular route — loadRoute', () => {
  it('detects circular route', () => {
    loadCircular()
    expect(useRouteStore.getState().route?.isCircular).toBe(true)
  })

  it('starts in phase 1', () => {
    loadCircular()
    expect(useRouteStore.getState().route?.circularPhase).toBe(1)
  })

  it('stores totalKm > 0', () => {
    loadCircular()
    expect(useRouteStore.getState().route?.totalKm).toBeGreaterThan(0)
  })

  it('snapshots originalCheckpoints', () => {
    loadCircular()
    const r = useRouteStore.getState().route!
    expect(r.originalCheckpoints).toBeDefined()
    expect(r.originalCheckpoints).toHaveLength(r.checkpoints.length)
  })
})

describe('circular route — phase 1 → 2', () => {
  it('first mark moves to phase 2', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    expect(useRouteStore.getState().route?.circularPhase).toBe(2)
  })

  it('first marked checkpoint becomes Старт at km 0', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(1) // mark second checkpoint
    const r = useRouteStore.getState().route!
    expect(r.checkpoints[0].name).toBe('Старт')
    expect(r.checkpoints[0].distanceKm).toBe(0)
    expect(r.checkpoints[0].checkedAt).toBeDefined()
  })

  it('virtual Финиш appears at end with totalKm', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    const r = useRouteStore.getState().route!
    const finish = r.checkpoints[r.checkpoints.length - 1]
    expect(finish.name).toBe('Финиш')
    expect(finish.distanceKm).toBeCloseTo(r.totalKm, 1)
  })

  it('all checkpoints have positive distanceKm except Старт', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    const r = useRouteStore.getState().route!
    r.checkpoints.slice(1, -1).forEach((cp) => {
      expect(cp.distanceKm).toBeGreaterThan(0)
    })
  })
})

describe('circular route — unmark in phase 2', () => {
  it('unmarkLast in phase 2 restores to phase 1', () => {
    loadCircular()
    const originalCount = useRouteStore.getState().route!.checkpoints.length
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().unmarkLast()
    const r = useRouteStore.getState().route!
    expect(r.circularPhase).toBe(1)
    expect(r.checkpoints.length).toBe(originalCount)
    expect(r.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })
})

describe('circular route — phase 2 → 3', () => {
  it('second mark moves to phase 3', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().markCheckpoint(1)
    expect(useRouteStore.getState().route?.circularPhase).toBe(3)
  })

  it('second mark and all before it are checked', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().markCheckpoint(1)
    const r = useRouteStore.getState().route!
    expect(r.checkpoints[0].checkedAt).toBeDefined()
    expect(r.checkpoints[1].checkedAt).toBeDefined()
  })
})

describe('circular route — reset', () => {
  it('resetProgress returns to phase 1 with no marks', () => {
    loadCircular()
    useRouteStore.getState().markCheckpoint(0)
    useRouteStore.getState().markCheckpoint(1)
    useRouteStore.getState().resetProgress()
    const r = useRouteStore.getState().route!
    expect(r.circularPhase).toBe(1)
    expect(r.checkpoints.every((cp) => cp.checkedAt === undefined)).toBe(true)
  })

  it('resetProgress restores original checkpoint count', () => {
    loadCircular()
    const originalCount = r0 => r0.checkpoints.length
    const before = originalCount(useRouteStore.getState().route!)
    useRouteStore.getState().markCheckpoint(0) // +1 virtual finish
    useRouteStore.getState().resetProgress()
    expect(useRouteStore.getState().route?.checkpoints.length).toBe(before)
  })
})
```

**Step 2: Run tests**
```
npx vitest run src/entities/route/store.test.ts
```
Исправить до зелёного.

**Step 3: Commit**
```bash
git add src/entities/route/store.test.ts
git commit -m "test: circular route store phase transitions"
```

---

## Task 6: Обновить `CheckpointList` — нумерация и кнопки

**Files:**
- Modify: `src/widgets/checkpoint-list/ui/CheckpointList.tsx`

**Логика изменений:**

| Состояние | Номер | Кнопка «Здесь» | Кнопка отмены |
|-----------|-------|-----------------|---------------|
| Линейный (любой) | Всегда | Только «следующая» | Только последняя |
| Кольцо фаза 1 | Нет | Все непройденные | — |
| Кольцо фаза 2 | Нет | Все непройденные | Только P (индекс 0) |
| Кольцо фаза 3 | Есть | Только «следующая» | Только последняя |

**Step 1: Implement**

```tsx
import { Check } from 'lucide-react'
import { useRouteStore } from '@/entities/route'
import { getLastChecked } from '@/entities/checkpoint'

function fmtMeta(distanceKm: number, checkedAt: number | undefined): string {
  const km = `${distanceKm.toFixed(1)} км`
  if (!checkedAt) return km
  const time = new Date(checkedAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${km} · ${time}`
}

export function CheckpointList() {
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)

  if (!route) return null

  const { isCircular, circularPhase } = route
  const showNumbers = !isCircular || circularPhase === 3
  const anyUncheckedMarkable = isCircular && circularPhase < 3
  const lastIdx = getLastChecked(route.checkpoints)

  return (
    <div className="flex flex-col gap-3 px-4">
      {route.checkpoints.map((cp, i) => {
        const checked = cp.checkedAt !== undefined
        const isLast = i === lastIdx

        // "Здесь" button visibility
        const isNext = anyUncheckedMarkable
          ? !checked
          : i === lastIdx + 1 || (lastIdx === -1 && i === 0)

        // Number display: only when showNumbers, skip for ring virtual endpoints in phase 2
        const showNumber = showNumbers
        const displayNumber = i + 1

        return (
          <div
            key={cp.id}
            className="flex items-start gap-3 min-h-[46px]"
          >
            {/* Number badge */}
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 rounded-full border border-[#e5e5e5] flex items-center justify-center">
              {showNumber ? (
                <span className="text-[11px] font-medium text-[#0a0a0a] font-mono leading-4">
                  {displayNumber}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#e5e5e5] block" />
              )}
            </div>

            {/* Name + meta */}
            <div
              className={`flex-1 min-w-0 flex flex-col gap-1.5 justify-center ${checked ? 'opacity-50' : ''}`}
            >
              <p className="text-sm font-medium leading-5 text-[#0a0a0a] truncate">{cp.name}</p>
              <p className="text-sm font-normal leading-5 text-[#737373]">
                {fmtMeta(cp.distanceKm, cp.checkedAt)}
              </p>
            </div>

            {/* Right action */}
            {checked ? (
              <button
                onClick={() => { if (isLast) unmarkLast() }}
                className={`w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center ${isLast ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={isLast ? 'Отменить' : undefined}
              >
                <Check className="w-[18px] h-[18px] text-[#0a0a0a]" strokeWidth={2} />
              </button>
            ) : isNext ? (
              <button
                onClick={() => markCheckpoint(i)}
                className="flex-shrink-0 h-9 w-[81px] border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] text-sm font-medium text-[#0a0a0a] active:bg-gray-50 transition-colors"
              >
                Здесь
              </button>
            ) : (
              <div className="w-[81px] flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Визуально проверить** в браузере на http://localhost:5176/. Загрузить кольцевой GPX — убедиться что номера скрыты в фазах 1/2.

**Step 3: Commit**
```bash
git add src/widgets/checkpoint-list/ui/CheckpointList.tsx
git commit -m "feat: hide numbers and allow any checkpoint in circular phases 1/2"
```

---

## Task 7: Задизейблить кнопку «История» в фазах 1/2

**Files:**
- Modify: `src/widgets/route-header/ui/RouteHeader.tsx`

**Step 1: Implement**

В `RouteHeader.tsx` добавить вычисление `historyDisabled` и применить к кнопке:

После строки `if (!route) return null` добавить:
```typescript
const historyDisabled = route.isCircular && route.circularPhase < 3
```

Кнопку «История» изменить:
```tsx
<button
  onClick={() => !historyDisabled && setHistoryOpen(true)}
  disabled={historyDisabled}
  className={`h-9 px-3 flex items-center gap-1.5 border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] transition-colors ${
    historyDisabled
      ? 'opacity-40 cursor-not-allowed'
      : 'active:bg-[#f5f5f5]'
  }`}
>
  <Clock className="w-4 h-4 text-[#0a0a0a]" />
  <span className="text-sm font-normal leading-5 text-[#0a0a0a]">История</span>
</button>
```

**Step 2: Проверить в браузере** — кнопка «История» должна быть серой на кольцевом маршруте до второй отметки.

**Step 3: Commit**
```bash
git add src/widgets/route-header/ui/RouteHeader.tsx
git commit -m "feat: disable history button on circular route phases 1/2"
```

---

## Task 8: Подсказки в `ProgressPanel` для фаз 1/2

**Files:**
- Modify: `src/widgets/progress-panel/ui/ProgressPanel.tsx`

**Step 1: Implement**

В `ProgressPanel.tsx`:

```tsx
export function ProgressPanel() {
  const route = useRouteStore((s) => s.route)
  if (!route) return null

  // Circular phase hints
  if (route.isCircular && route.circularPhase === 1) {
    return (
      <div className="flex items-center justify-center px-4 py-3 bg-white border-b border-gray-100">
        <p className="text-sm text-[#737373] text-center">
          Отметьте первую точку — она станет началом маршрута
        </p>
      </div>
    )
  }

  if (route.isCircular && route.circularPhase === 2) {
    return (
      <div className="flex items-center justify-center px-4 py-3 bg-white border-b border-gray-100">
        <p className="text-sm text-[#737373] text-center">
          Отметьте ещё одну точку — она задаст направление
        </p>
      </div>
    )
  }

  // Normal stats (linear or circular phase 3)
  const covered = selectCoveredKm(route)
  const remaining = selectRemainingKm(route)
  const total = selectTotalKm(route)
  const forecast = selectFinishForecast(route)

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 text-sm">
      <div className="text-center">
        <p className="text-xs text-gray-400">Пройдено</p>
        <p className="font-semibold text-gray-900">{covered.toFixed(1)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Осталось</p>
        <p className="font-semibold text-gray-900">{remaining.toFixed(1)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Всего</p>
        <p className="font-semibold text-gray-900">{total.toFixed(1)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Финиш ~</p>
        <p className="font-semibold text-gray-900">{fmtTime(forecast)}</p>
      </div>
    </div>
  )
}

function fmtTime(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
```

**Step 2: Commit**
```bash
git add src/widgets/progress-panel/ui/ProgressPanel.tsx
git commit -m "feat: show circular route hints in ProgressPanel phases 1/2"
```

---

## Task 9: Карта — не рисовать пройденный трек до фазы 3

**Files:**
- Modify: `src/widgets/route-map/ui/RouteMap.tsx`

**Step 1: Implement**

В обоих `useEffect`, где вызывается `adapter.drawTrack`, добавить условие:

```typescript
// Redraw when checkpoints change
useEffect(() => {
  if (!adapterRef.current || !route) return
  const lastIdx = getLastChecked(route.checkpoints)

  // Don't draw covered track until direction is known (circular phases 1/2)
  const directionKnown = !route.isCircular || route.circularPhase === 3
  const trackIdx = directionKnown && lastIdx >= 0
    ? route.checkpoints[lastIdx].trackIndex
    : 0

  adapterRef.current.drawTrack(route.trackPoints, trackIdx)
  adapterRef.current.drawCheckpoints(route.checkpoints, handleTap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [route?.checkpoints])
```

То же в init `useEffect`:
```typescript
const directionKnown = !route.isCircular || route.circularPhase === 3
const trackIdx = directionKnown && lastIdx >= 0
  ? route.checkpoints[lastIdx].trackIndex
  : 0
adapter.drawTrack(route.trackPoints, trackIdx)
```

**Step 2: Проверить в браузере** — на кольце в фазе 2 карта не красит трек.

**Step 3: Commit**
```bash
git add src/widgets/route-map/ui/RouteMap.tsx
git commit -m "feat: suppress covered track drawing on circular route phases 1/2"
```

---

## Task 10: E2E smoke-test + финальная проверка

**Step 1: Запустить все тесты**
```
npx vitest run
```
Все должны быть зелёными.

**Step 2: TypeScript**
```
npx tsc --noEmit
```
Без ошибок.

**Step 3: Ручная проверка**

Загрузить кольцевой GPX (или создать тестовый с track[0] ≈ track[last]):

- [ ] Фаза 1: номеров нет, «Здесь» у всех точек, кнопка «История» серая, трек дотсом
- [ ] Первая отметка: фаза 2, «Старт» вверху (km 0, с галкой), «Финиш» внизу (полный км), подсказка про вторую точку
- [ ] Можно снять первую отметку → возврат в фазу 1
- [ ] Вторая отметка: фаза 3, номера появились, пройденный участок закрасился
- [ ] Сброс → фаза 1

**Step 4: Commit**
```bash
git add -A
git commit -m "feat: circular route support — three-phase marking"
```
