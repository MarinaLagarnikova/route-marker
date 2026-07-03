# Вешка — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first web app where hikers load a GPX track and manually check off waypoints as they go, with optional GPS position indicator, no backend.

**Architecture:** Feature-Sliced Design (FSD) with strict top-down imports (pages → widgets → features → entities → shared). All map logic isolated behind `shared/lib/map-adapter` so the provider (Yandex Maps v3) is swappable. State in zustand, persisted to localStorage.

**Tech Stack:** React 18, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui, zustand, Yandex Maps JS API v3, vitest.

---

## Task 1: Project Scaffold

**Files:**
- Run: `npm create vite@latest . -- --template react-ts` (in project root)
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Create: `.env`
- Create: `.env.example`

**Step 1: Scaffold Vite project**
```bash
cd "/Users/marinalagarnikova/Desktop/Dev/route marker"
npm create vite@latest . -- --template react-ts
npm install
```

**Step 2: Install dependencies**
```bash
npm install zustand
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @types/node
```

**Step 3: Install Tailwind**
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 4: Install shadcn/ui**
```bash
npx shadcn@latest init
```
Choose: TypeScript, style Default, base color Neutral, CSS variables yes, src/shared/ui as components path.

**Step 5: Configure tsconfig.json** — enable strict, set paths alias `@/*` → `./src/*`
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**Step 6: Configure vite.config.ts**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
})
```

**Step 7: Create .env**
```
VITE_YANDEX_MAPS_API_KEY=b2527b51-9d68-4a72-ae7f-d8133f48bd1d
```

**Step 8: Create .env.example**
```
VITE_YANDEX_MAPS_API_KEY=your_key_here
```

**Step 9: Create src/test-setup.ts**
```ts
import '@testing-library/jest-dom'
```

**Step 10: Create FSD directory skeleton**
```bash
mkdir -p src/app
mkdir -p src/pages/start src/pages/route
mkdir -p src/widgets/route-header src/widgets/progress-panel src/widgets/route-map src/widgets/checkpoint-list
mkdir -p src/features/upload-gpx src/features/mark-checkpoint src/features/reset-progress
mkdir -p src/entities/route src/entities/checkpoint
mkdir -p src/shared/ui src/shared/lib/gpx src/shared/lib/geo src/shared/lib/storage src/shared/lib/map-adapter src/shared/config
```

**Step 11: Commit**
```bash
git init
git add -A
git commit -m "feat: scaffold Vite+React+TS project with FSD structure"
```

---

## Task 2: shared/config

**Files:**
- Create: `src/shared/config/index.ts`

**Step 1: Create config**
```ts
// src/shared/config/index.ts
export const APP_NAME = 'Вешка'
export const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string
export const STORAGE_KEY_PREFIX = 'veshka_'
export const AUTO_CHECKPOINT_INTERVAL_KM = 1
export const MIN_CHECKPOINTS_BEFORE_AUTO = 3
```

**Step 2: Commit**
```bash
git add src/shared/config/
git commit -m "feat: add shared config with app name and env keys"
```

---

## Task 3: shared/lib/geo — геометрия

**Files:**
- Create: `src/shared/lib/geo/index.ts`
- Create: `src/shared/lib/geo/geo.test.ts`

**Step 1: Write failing tests**
```ts
// src/shared/lib/geo/geo.test.ts
import { describe, it, expect } from 'vitest'
import { haversineKm, cumulativeDistances, projectWptOnTrack } from './index'

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm({ lat: 55.75, lon: 37.61 }, { lat: 55.75, lon: 37.61 })).toBeCloseTo(0)
  })
  it('Moscow to SPb ~635km', () => {
    expect(haversineKm({ lat: 55.75, lon: 37.61 }, { lat: 59.93, lon: 30.32 })).toBeCloseTo(635, -1)
  })
})

describe('cumulativeDistances', () => {
  it('first element is always 0', () => {
    const pts = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }]
    expect(cumulativeDistances(pts)[0]).toBe(0)
  })
  it('returns array same length as input', () => {
    const pts = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]
    expect(cumulativeDistances(pts)).toHaveLength(3)
  })
  it('distances are monotonically increasing', () => {
    const pts = [{ lat: 55, lon: 37 }, { lat: 55.1, lon: 37 }, { lat: 55.2, lon: 37 }]
    const d = cumulativeDistances(pts)
    expect(d[1]).toBeGreaterThan(d[0])
    expect(d[2]).toBeGreaterThan(d[1])
  })
})

describe('projectWptOnTrack', () => {
  it('returns index of nearest track point', () => {
    const track = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]
    expect(projectWptOnTrack({ lat: 0, lon: 0.9 }, track)).toBe(1)
  })
})
```

**Step 2: Run tests — expect FAIL**
```bash
npx vitest run src/shared/lib/geo/geo.test.ts
```

**Step 3: Implement geo**
```ts
// src/shared/lib/geo/index.ts
export interface LatLon { lat: number; lon: number }

const R = 6371 // km

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function cumulativeDistances(points: LatLon[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    result.push(result[i - 1] + haversineKm(points[i - 1], points[i]))
  }
  return result
}

export function projectWptOnTrack(wpt: LatLon, track: LatLon[]): number {
  let minDist = Infinity
  let minIdx = 0
  for (let i = 0; i < track.length; i++) {
    const d = haversineKm(wpt, track[i])
    if (d < minDist) { minDist = d; minIdx = i }
  }
  return minIdx
}
```

**Step 4: Run tests — expect PASS**
```bash
npx vitest run src/shared/lib/geo/geo.test.ts
```

**Step 5: Commit**
```bash
git add src/shared/lib/geo/
git commit -m "feat: add geo lib (haversine, cumulative distances, wpt projection)"
```

---

## Task 4: shared/lib/gpx — парсер

**Files:**
- Create: `src/shared/lib/gpx/index.ts`
- Create: `src/shared/lib/gpx/gpx.test.ts`

**Step 1: Write failing tests**
```ts
// src/shared/lib/gpx/gpx.test.ts
import { describe, it, expect } from 'vitest'
import { parseGpx } from './index'

const SIMPLE_GPX = `<?xml version="1.0"?>
<gpx>
  <metadata><name>Test Route</name></metadata>
  <trk>
    <trkseg>
      <trkpt lat="55.0" lon="37.0"/>
      <trkpt lat="55.1" lon="37.1"/>
      <trkpt lat="55.2" lon="37.2"/>
    </trkseg>
  </trk>
  <wpt lat="55.1" lon="37.1"><name>Середина</name></wpt>
</gpx>`

const NO_TRACK_GPX = `<?xml version="1.0"><gpx></gpx>`

describe('parseGpx', () => {
  it('parses track points', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.trackPoints).toHaveLength(3)
    expect(result.trackPoints[0]).toMatchObject({ lat: 55.0, lon: 37.0 })
  })

  it('parses metadata name', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.name).toBe('Test Route')
  })

  it('parses waypoints', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.waypoints).toHaveLength(1)
    expect(result.waypoints[0].name).toBe('Середина')
  })

  it('throws on missing track', () => {
    expect(() => parseGpx(NO_TRACK_GPX)).toThrow()
  })
})
```

**Step 2: Run — expect FAIL**
```bash
npx vitest run src/shared/lib/gpx/gpx.test.ts
```

**Step 3: Implement GPX parser**
```ts
// src/shared/lib/gpx/index.ts
import type { LatLon } from '@/shared/lib/geo'

export interface GpxWaypoint extends LatLon { name: string }
export interface GpxData {
  name: string
  trackPoints: LatLon[]
  waypoints: GpxWaypoint[]
}

export function parseGpx(xml: string): GpxData {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Файл повреждён: не удалось разобрать XML')

  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  const rtepts = Array.from(doc.querySelectorAll('rtept'))
  const rawPoints = trkpts.length ? trkpts : rtepts

  if (rawPoints.length < 2) {
    throw new Error('GPX-файл не содержит трека (нужно минимум 2 точки trkpt/rtept)')
  }

  const trackPoints: LatLon[] = rawPoints.map((el) => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
  }))

  const waypoints: GpxWaypoint[] = Array.from(doc.querySelectorAll('wpt')).map((el) => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    name: el.querySelector('name')?.textContent?.trim() ?? 'Точка',
  }))

  const metaName = doc.querySelector('metadata > name')?.textContent?.trim()
  const trkName = doc.querySelector('trk > name')?.textContent?.trim()
  const name = metaName ?? trkName ?? ''

  return { name, trackPoints, waypoints }
}
```

**Step 4: Run — expect PASS**
```bash
npx vitest run src/shared/lib/gpx/gpx.test.ts
```

**Step 5: Commit**
```bash
git add src/shared/lib/gpx/
git commit -m "feat: add GPX parser (trkpt/rtept/wpt, DOMParser, no deps)"
```

---

## Task 5: shared/lib/storage — обёртка localStorage

**Files:**
- Create: `src/shared/lib/storage/index.ts`

**Step 1: Implement**
```ts
// src/shared/lib/storage/index.ts
import { STORAGE_KEY_PREFIX } from '@/shared/config'

export function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value))
  } catch {
    // quota exceeded — ignore silently
  }
}

export function storageRemove(key: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + key)
}

export function storageKeys(): string[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_KEY_PREFIX))
    .map((k) => k.slice(STORAGE_KEY_PREFIX.length))
}
```

**Step 2: Commit**
```bash
git add src/shared/lib/storage/
git commit -m "feat: add typed localStorage wrapper"
```

---

## Task 6: entities/checkpoint — модель контрольной точки

**Files:**
- Create: `src/entities/checkpoint/model.ts`
- Create: `src/entities/checkpoint/index.ts`
- Create: `src/entities/checkpoint/checkpoint.test.ts`

**Step 1: Write failing tests**
```ts
// src/entities/checkpoint/checkpoint.test.ts
import { describe, it, expect } from 'vitest'
import { buildCheckpoints, getLastChecked, canUncheck } from './model'
import type { LatLon } from '@/shared/lib/geo'

const track: LatLon[] = [
  { lat: 0, lon: 0 },
  { lat: 0, lon: 1 },
  { lat: 0, lon: 2 },
  { lat: 0, lon: 3 },
]

describe('buildCheckpoints', () => {
  it('always adds Start and Finish', () => {
    const cps = buildCheckpoints(track, [])
    expect(cps[0].name).toBe('Старт')
    expect(cps[cps.length - 1].name).toBe('Финиш')
  })

  it('auto-generates 1km checkpoints when <3 waypoints', () => {
    // track spans ~333km at these coords; just verify auto-generation runs
    const cps = buildCheckpoints(track, [])
    expect(cps.length).toBeGreaterThan(2)
  })

  it('uses provided waypoints when >=3 given', () => {
    const wpts = [
      { lat: 0, lon: 0.5, name: 'A' },
      { lat: 0, lon: 1.5, name: 'B' },
      { lat: 0, lon: 2.5, name: 'C' },
    ]
    const cps = buildCheckpoints(track, wpts)
    const names = cps.map((c) => c.name)
    expect(names).toContain('A')
  })
})

describe('canUncheck', () => {
  it('returns false for non-last checked', () => {
    const cps = buildCheckpoints(track, [])
    const marked = cps.map((c, i) => ({ ...c, checkedAt: i < 2 ? Date.now() : undefined }))
    expect(canUncheck(marked, 0)).toBe(false)
  })
  it('returns true for last checked', () => {
    const cps = buildCheckpoints(track, [])
    const marked = cps.map((c, i) => ({ ...c, checkedAt: i === 0 ? Date.now() : undefined }))
    expect(canUncheck(marked, 0)).toBe(true)
  })
})
```

**Step 2: Run — expect FAIL**
```bash
npx vitest run src/entities/checkpoint/checkpoint.test.ts
```

**Step 3: Implement**
```ts
// src/entities/checkpoint/model.ts
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
  checkedAt?: number // timestamp ms
}

export function buildCheckpoints(track: LatLon[], waypoints: GpxWaypoint[]): Checkpoint[] {
  const dists = cumulativeDistances(track)
  const totalKm = dists[dists.length - 1]

  const rawWpts: GpxWaypoint[] =
    waypoints.length >= MIN_CHECKPOINTS_BEFORE_AUTO
      ? waypoints
      : generateAutoWaypoints(track, dists, totalKm)

  // Project each wpt onto track, sort by trackIndex
  const projected = rawWpts.map((w) => {
    const idx = projectWptOnTrack(w, track)
    return { ...w, trackIndex: idx, distanceKm: dists[idx] }
  })
  projected.sort((a, b) => a.trackIndex - b.trackIndex)

  // Ensure Start and Finish
  const start: Omit<Checkpoint, 'id'> = {
    name: 'Старт',
    lat: track[0].lat,
    lon: track[0].lon,
    trackIndex: 0,
    distanceKm: 0,
  }
  const finish: Omit<Checkpoint, 'id'> = {
    name: 'Финиш',
    lat: track[track.length - 1].lat,
    lon: track[track.length - 1].lon,
    trackIndex: track.length - 1,
    distanceKm: totalKm,
  }

  // Deduplicate: remove any projected point within 50m of start/finish
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
```

```ts
// src/entities/checkpoint/index.ts
export type { Checkpoint } from './model'
export { buildCheckpoints, getLastChecked, canUncheck } from './model'
```

**Step 4: Run — expect PASS**
```bash
npx vitest run src/entities/checkpoint/checkpoint.test.ts
```

**Step 5: Commit**
```bash
git add src/entities/checkpoint/
git commit -m "feat: add checkpoint entity model with auto-generation and uncheck rules"
```

---

## Task 7: entities/route — стор маршрута

**Files:**
- Create: `src/entities/route/model.ts`
- Create: `src/entities/route/store.ts`
- Create: `src/entities/route/selectors.ts`
- Create: `src/entities/route/index.ts`
- Create: `src/entities/route/route.test.ts`

**Step 1: Write failing tests**
```ts
// src/entities/route/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { detectDirection, applyCheckmark, computeFinishForecast } from './model'
import type { Checkpoint } from '@/entities/checkpoint'

function makeCheckpoints(n: number): Checkpoint[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `cp_${i}`,
    name: `КТ ${i}`,
    lat: 0,
    lon: i * 0.1,
    trackIndex: i * 10,
    distanceKm: i * 1.0,
  }))
}

describe('detectDirection', () => {
  it('forward when first mark is in first half', () => {
    const cps = makeCheckpoints(10)
    expect(detectDirection(cps, 2, 10)).toBe('forward')
  })
  it('reverse when first mark is in second half', () => {
    const cps = makeCheckpoints(10)
    expect(detectDirection(cps, 7, 10)).toBe('reverse')
  })
})

describe('applyCheckmark', () => {
  it('marks target and all previous', () => {
    const cps = makeCheckpoints(5)
    const now = Date.now()
    const result = applyCheckmark(cps, 2, now)
    expect(result[0].checkedAt).toBeDefined()
    expect(result[1].checkedAt).toBeDefined()
    expect(result[2].checkedAt).toBeDefined()
    expect(result[3].checkedAt).toBeUndefined()
  })
})

describe('computeFinishForecast', () => {
  it('returns null when fewer than 2 checked', () => {
    const cps = makeCheckpoints(5)
    cps[0].checkedAt = 1000
    expect(computeFinishForecast(cps)).toBeNull()
  })
  it('returns a timestamp when >=2 checked', () => {
    const cps = makeCheckpoints(5)
    cps[0].checkedAt = 0
    cps[1].checkedAt = 3600_000 // 1 hour later
    const result = computeFinishForecast(cps)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('number')
  })
})
```

**Step 2: Run — expect FAIL**
```bash
npx vitest run src/entities/route/route.test.ts
```

**Step 3: Implement model**
```ts
// src/entities/route/model.ts
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
    i <= targetIndex && cp.checkedAt === undefined
      ? { ...cp, checkedAt: timestamp }
      : cp
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
  const pace = elapsed / coveredKm // ms per km
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

**Step 4: Create zustand store**
```ts
// src/entities/route/store.ts
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
        checkpoints = [...checkpoints].reverse().map((cp, i, arr) => ({
          ...cp,
          distanceKm: arr[arr.length - 1].distanceKm - cp.distanceKm,
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
    const updated = checkpoints.map((cp, i) =>
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
```

**Step 5: Create selectors**
```ts
// src/entities/route/selectors.ts
import type { RouteState } from './model'
import { computeFinishForecast } from './model'

export function selectCheckedCount(route: RouteState): number {
  return route.checkpoints.filter((cp) => cp.checkedAt !== undefined).length
}

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
```

**Step 6: Create index**
```ts
// src/entities/route/index.ts
export type { RouteState, Direction } from './model'
export { hashString } from './model'
export { useRouteStore } from './store'
export {
  selectCheckedCount,
  selectCoveredKm,
  selectRemainingKm,
  selectTotalKm,
  selectFinishForecast,
} from './selectors'
```

**Step 7: Run tests — expect PASS**
```bash
npx vitest run src/entities/route/route.test.ts
```

**Step 8: Commit**
```bash
git add src/entities/route/
git commit -m "feat: add route entity (model, zustand store, selectors)"
```

---

## Task 8: shared/lib/map-adapter — адаптер Яндекс Карт

**Files:**
- Create: `src/shared/lib/map-adapter/types.ts`
- Create: `src/shared/lib/map-adapter/yandex.ts`
- Create: `src/shared/lib/map-adapter/index.ts`

**Step 1: Define interface**
```ts
// src/shared/lib/map-adapter/types.ts
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'

export interface MapAdapter {
  init(container: HTMLElement, center: LatLon, zoom: number): Promise<void>
  destroy(): void
  drawTrack(points: LatLon[], checkedUpToIndex: number): void
  drawCheckpoints(
    checkpoints: Checkpoint[],
    onTap: (index: number) => void
  ): void
  updateUserPosition(pos: LatLon | null): void
  fitBounds(points: LatLon[]): void
  setLayer(layer: 'map' | 'satellite' | 'hybrid'): void
}
```

**Step 2: Implement Yandex adapter**
```ts
// src/shared/lib/map-adapter/yandex.ts
import { YANDEX_MAPS_API_KEY } from '@/shared/config'
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'
import type { MapAdapter } from './types'

declare global {
  interface Window {
    ymaps3: typeof import('@yandex/ymaps3-types')
  }
}

let scriptLoaded = false
let scriptLoadPromise: Promise<void> | null = null

function loadYandexScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`
    script.onload = () => { scriptLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Не удалось загрузить Яндекс Карты'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

export function createYandexAdapter(): MapAdapter {
  let map: import('@yandex/ymaps3-types').YMap | null = null
  let ymaps3: typeof import('@yandex/ymaps3-types') | null = null
  let trackFeatures: unknown[] = []
  let checkpointFeatures: unknown[] = []
  let userMarker: unknown | null = null
  let featuresLayer: unknown | null = null

  return {
    async init(container, center, zoom) {
      try {
        await loadYandexScript()
        await window.ymaps3.ready
        ymaps3 = window.ymaps3
        const { YMap, YMapDefaultSchemeLayer, YMapLayer, YMapFeatureDataSource, YMapControls } = ymaps3

        map = new YMap(container, {
          location: { center: [center.lon, center.lat], zoom },
        })

        map.addChild(new YMapDefaultSchemeLayer({}))

        const dataSource = new YMapFeatureDataSource({ id: 'main' })
        const { YMapFeatureLayer } = ymaps3
        featuresLayer = new YMapFeatureLayer({ source: 'main' })
        map.addChild(dataSource as unknown as import('@yandex/ymaps3-types').YMapEntity<unknown>)
        map.addChild(featuresLayer as unknown as import('@yandex/ymaps3-types').YMapEntity<unknown>)
      } catch (e) {
        console.warn('Яндекс Карты недоступны, карта работает без тайлов', e)
      }
    },

    destroy() {
      map?.destroy()
      map = null
    },

    drawTrack(points, checkedUpToIndex) {
      if (!ymaps3 || !map) return
      // Remove existing track features
      trackFeatures.forEach((f) => {
        try { (map as unknown as { removeChild(c: unknown): void }).removeChild(f) } catch {}
      })
      trackFeatures = []

      const { YMapFeature } = ymaps3
      const coords = points.map((p): [number, number] => [p.lon, p.lat])

      if (checkedUpToIndex > 0) {
        const done = new YMapFeature({
          id: 'track-done',
          geometry: { type: 'LineString', coordinates: coords.slice(0, checkedUpToIndex + 1) },
          style: { stroke: [{ color: '#e53e3e', width: 4 }] },
        })
        map.addChild(done)
        trackFeatures.push(done)
      }

      const remaining = new YMapFeature({
        id: 'track-remaining',
        geometry: {
          type: 'LineString',
          coordinates: coords.slice(Math.max(0, checkedUpToIndex)),
        },
        style: { stroke: [{ color: '#9ca3af', width: 3, dash: [8, 6] }] },
      })
      map.addChild(remaining)
      trackFeatures.push(remaining)
    },

    drawCheckpoints(checkpoints, onTap) {
      if (!ymaps3 || !map) return
      checkpointFeatures.forEach((f) => {
        try { (map as unknown as { removeChild(c: unknown): void }).removeChild(f) } catch {}
      })
      checkpointFeatures = []

      const { YMapMarker } = ymaps3
      checkpoints.forEach((cp, i) => {
        const el = document.createElement('div')
        el.style.cssText = `
          width:28px;height:28px;border-radius:50%;cursor:pointer;
          border:3px solid ${cp.checkedAt ? '#e53e3e' : '#374151'};
          background:${cp.checkedAt ? '#e53e3e' : '#f9fafb'};
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:700;color:${cp.checkedAt ? '#fff' : '#374151'};
        `
        el.textContent = String(i + 1)
        el.addEventListener('click', () => onTap(i))

        const marker = new YMapMarker(
          { coordinates: [cp.lon, cp.lat] },
          el
        )
        map!.addChild(marker)
        checkpointFeatures.push(marker)
      })
    },

    updateUserPosition(pos) {
      if (!ymaps3 || !map) return
      if (userMarker) {
        try { (map as unknown as { removeChild(c: unknown): void }).removeChild(userMarker) } catch {}
        userMarker = null
      }
      if (!pos) return

      const { YMapMarker } = ymaps3
      const el = document.createElement('div')
      el.style.cssText = `
        width:16px;height:16px;border-radius:50%;
        background:#3b82f6;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(59,130,246,0.4);
      `
      userMarker = new YMapMarker({ coordinates: [pos.lon, pos.lat] }, el)
      map.addChild(userMarker as unknown as import('@yandex/ymaps3-types').YMapEntity<unknown>)
    },

    fitBounds(points) {
      if (!map || !points.length) return
      const lats = points.map((p) => p.lat)
      const lons = points.map((p) => p.lon)
      const sw: [number, number] = [Math.min(...lons), Math.min(...lats)]
      const ne: [number, number] = [Math.max(...lons), Math.max(...lats)]
      map.update({ location: { bounds: [sw, ne], duration: 300 } })
    },

    setLayer(_layer) {
      // Layer switching via ymaps3 requires recreating scheme layer — simplified for now
    },
  }
}
```

**Step 3: Create index**
```ts
// src/shared/lib/map-adapter/index.ts
export type { MapAdapter } from './types'
export { createYandexAdapter } from './yandex'
```

**Step 4: Commit**
```bash
git add src/shared/lib/map-adapter/
git commit -m "feat: add Yandex Maps adapter behind MapAdapter interface"
```

---

## Task 9: features/upload-gpx

**Files:**
- Create: `src/features/upload-gpx/ui/UploadGpx.tsx`
- Create: `src/features/upload-gpx/index.ts`

**Step 1: Implement**
```tsx
// src/features/upload-gpx/ui/UploadGpx.tsx
import { useRef, useState } from 'react'
import { parseGpx } from '@/shared/lib/gpx'
import type { GpxData } from '@/shared/lib/gpx'

interface Props {
  onParsed: (data: GpxData, xml: string) => void
}

export function UploadGpx({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const xml = ev.target?.result as string
      try {
        const data = parseGpx(xml)
        setError(null)
        onParsed(data, xml)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка разбора файла')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 text-sm font-medium hover:border-gray-400 active:bg-gray-50 transition-colors"
      >
        Выбрать GPX-файл
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={handleFile}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

```ts
// src/features/upload-gpx/index.ts
export { UploadGpx } from './ui/UploadGpx'
```

**Step 2: Commit**
```bash
git add src/features/upload-gpx/
git commit -m "feat: add upload-gpx feature component"
```

---

## Task 10: features/mark-checkpoint и reset-progress

**Files:**
- Create: `src/features/mark-checkpoint/index.ts`
- Create: `src/features/reset-progress/ui/ResetButton.tsx`
- Create: `src/features/reset-progress/index.ts`

**Step 1: mark-checkpoint (логика в сторе, экспортируем хук)**
```ts
// src/features/mark-checkpoint/index.ts
export { useRouteStore } from '@/entities/route'
// mark and unmark are called directly via useRouteStore().markCheckpoint / .unmarkLast
```

**Step 2: reset-progress**

Install AlertDialog via shadcn first:
```bash
npx shadcn@latest add alert-dialog
```

```tsx
// src/features/reset-progress/ui/ResetButton.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { useRouteStore } from '@/entities/route'

export function ResetButton() {
  const resetProgress = useRouteStore((s) => s.resetProgress)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="text-xs text-gray-400 underline underline-offset-2 py-1 px-2 min-h-[44px] flex items-center">
          Сбросить прогресс
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Сбросить все отметки?</AlertDialogTitle>
          <AlertDialogDescription>
            Все пройденные точки будут сброшены. Маршрут останется загруженным.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={resetProgress}>Сбросить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

```ts
// src/features/reset-progress/index.ts
export { ResetButton } from './ui/ResetButton'
```

**Step 3: Commit**
```bash
git add src/features/
git commit -m "feat: add mark-checkpoint and reset-progress features"
```

---

## Task 11: widgets/route-header

**Files:**
- Create: `src/widgets/route-header/ui/RouteHeader.tsx`
- Create: `src/widgets/route-header/index.ts`

**Step 1: Implement**
```tsx
// src/widgets/route-header/ui/RouteHeader.tsx
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '@/shared/config'
import { useRouteStore } from '@/entities/route'

export function RouteHeader() {
  const navigate = useNavigate()
  const name = useRouteStore((s) => s.route?.name ?? '')

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
      <button
        onClick={() => navigate('/')}
        aria-label="На главную"
        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{APP_NAME}</p>
        <h1 className="text-base font-semibold text-gray-900 truncate">{name}</h1>
      </div>
    </header>
  )
}
```

```ts
// src/widgets/route-header/index.ts
export { RouteHeader } from './ui/RouteHeader'
```

**Step 2: Commit**
```bash
git add src/widgets/route-header/
git commit -m "feat: add route-header widget"
```

---

## Task 12: widgets/progress-panel

**Files:**
- Create: `src/widgets/progress-panel/ui/ProgressPanel.tsx`
- Create: `src/widgets/progress-panel/index.ts`

**Step 1: Implement (простая плоская разметка, логика — через селекторы)**
```tsx
// src/widgets/progress-panel/ui/ProgressPanel.tsx
import { useRouteStore } from '@/entities/route'
import {
  selectCoveredKm,
  selectRemainingKm,
  selectFinishForecast,
  selectTotalKm,
} from '@/entities/route'

function fmt(km: number): string {
  return km.toFixed(1)
}

function fmtTime(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function ProgressPanel() {
  const route = useRouteStore((s) => s.route)
  if (!route) return null

  const covered = selectCoveredKm(route)
  const remaining = selectRemainingKm(route)
  const total = selectTotalKm(route)
  const forecast = selectFinishForecast(route)

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 text-sm">
      <div className="text-center">
        <p className="text-xs text-gray-400">Пройдено</p>
        <p className="font-semibold text-gray-900">{fmt(covered)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Осталось</p>
        <p className="font-semibold text-gray-900">{fmt(remaining)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Всего</p>
        <p className="font-semibold text-gray-900">{fmt(total)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Финиш ~</p>
        <p className="font-semibold text-gray-900">{fmtTime(forecast)}</p>
      </div>
    </div>
  )
}
```

```ts
// src/widgets/progress-panel/index.ts
export { ProgressPanel } from './ui/ProgressPanel'
```

**Step 2: Commit**
```bash
git add src/widgets/progress-panel/
git commit -m "feat: add progress-panel widget (flat markup, logic via selectors)"
```

---

## Task 13: widgets/route-map

**Files:**
- Create: `src/widgets/route-map/ui/RouteMap.tsx`
- Create: `src/widgets/route-map/index.ts`

**Step 1: Implement**
```tsx
// src/widgets/route-map/ui/RouteMap.tsx
import { useEffect, useRef, useState } from 'react'
import { createYandexAdapter } from '@/shared/lib/map-adapter'
import type { MapAdapter } from '@/shared/lib/map-adapter'
import { useRouteStore } from '@/entities/route'
import { getLastChecked } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'

export function RouteMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<MapAdapter | null>(null)
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)
  const [userPos, setUserPos] = useState<LatLon | null>(null)
  const [layer, setLayer] = useState<'map' | 'satellite' | 'hybrid'>('map')

  // Init map once
  useEffect(() => {
    if (!containerRef.current || !route) return
    const adapter = createYandexAdapter()
    adapterRef.current = adapter
    const center = route.trackPoints[0]
    adapter.init(containerRef.current, center, 12).then(() => {
      adapter.fitBounds(route.trackPoints)
      const lastIdx = getLastChecked(route.checkpoints)
      const trackIdx = lastIdx >= 0 ? route.checkpoints[lastIdx].trackIndex : 0
      adapter.drawTrack(route.trackPoints, trackIdx)
      adapter.drawCheckpoints(route.checkpoints, handleTap)
    })

    return () => { adapter.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw when checkpoints change
  useEffect(() => {
    if (!adapterRef.current || !route) return
    const lastIdx = getLastChecked(route.checkpoints)
    const trackIdx = lastIdx >= 0 ? route.checkpoints[lastIdx].trackIndex : 0
    adapterRef.current.drawTrack(route.trackPoints, trackIdx)
    adapterRef.current.drawCheckpoints(route.checkpoints, handleTap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.checkpoints])

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setUserPos(null),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Update user position on map
  useEffect(() => {
    adapterRef.current?.updateUserPosition(userPos)
  }, [userPos])

  // Layer change
  useEffect(() => {
    adapterRef.current?.setLayer(layer)
  }, [layer])

  function handleTap(index: number) {
    if (!route) return
    const cp = route.checkpoints[index]
    const lastIdx = getLastChecked(route.checkpoints)
    if (cp.checkedAt !== undefined && index === lastIdx) {
      unmarkLast()
    } else if (cp.checkedAt === undefined) {
      markCheckpoint(index)
    }
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {(['map', 'satellite', 'hybrid'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            className={`px-2 py-1 text-xs rounded shadow ${
              layer === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            {l === 'map' ? 'Схема' : l === 'satellite' ? 'Спутник' : 'Гибрид'}
          </button>
        ))}
      </div>
    </div>
  )
}
```

```ts
// src/widgets/route-map/index.ts
export { RouteMap } from './ui/RouteMap'
```

**Step 2: Commit**
```bash
git add src/widgets/route-map/
git commit -m "feat: add route-map widget with Yandex Maps adapter and GPS watch"
```

---

## Task 14: widgets/checkpoint-list

**Files:**
- Create: `src/widgets/checkpoint-list/ui/CheckpointList.tsx`
- Create: `src/widgets/checkpoint-list/index.ts`

**Step 1: Add shadcn components**
```bash
npx shadcn@latest add scroll-area
```

**Step 2: Implement**
```tsx
// src/widgets/checkpoint-list/ui/CheckpointList.tsx
import { useRouteStore } from '@/entities/route'
import { getLastChecked, canUncheck } from '@/entities/checkpoint'
import { ResetButton } from '@/features/reset-progress'

function fmtTime(ts: number | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function CheckpointList() {
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)
  if (!route) return null

  const lastIdx = getLastChecked(route.checkpoints)

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Контрольные точки
        </p>
        <ResetButton />
      </div>
      <div className="overflow-y-auto">
        {route.checkpoints.map((cp, i) => {
          const checked = cp.checkedAt !== undefined
          const isLast = i === lastIdx
          const canAct = checked ? isLast : (lastIdx === -1 || i === lastIdx + 1 || !checked)

          return (
            <div
              key={cp.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 ${
                checked ? 'bg-red-50' : 'bg-white'
              }`}
            >
              <div
                className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  checked
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${checked ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                  {cp.name}
                </p>
                <p className="text-xs text-gray-400">
                  {cp.distanceKm.toFixed(1)} км
                  {cp.checkedAt ? ` · ${fmtTime(cp.checkedAt)}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (checked && isLast) unmarkLast()
                  else if (!checked) markCheckpoint(i)
                }}
                disabled={!canAct && !checked}
                className={`min-w-[72px] min-h-[44px] rounded-lg text-sm font-medium transition-colors px-3 ${
                  checked && isLast
                    ? 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    : checked
                    ? 'bg-transparent text-transparent cursor-default'
                    : canAct
                    ? 'bg-red-600 text-white active:bg-red-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {checked && isLast ? 'Отменить' : !checked && canAct ? 'Здесь' : checked ? '' : 'Здесь'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

```ts
// src/widgets/checkpoint-list/index.ts
export { CheckpointList } from './ui/CheckpointList'
```

**Step 3: Commit**
```bash
git add src/widgets/checkpoint-list/
git commit -m "feat: add checkpoint-list widget with mark/unmark and 44px touch targets"
```

---

## Task 15: pages/start

**Files:**
- Create: `src/pages/start/ui/StartPage.tsx`
- Create: `src/pages/start/index.ts`

**Step 1: Implement**
```tsx
// src/pages/start/ui/StartPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadGpx } from '@/features/upload-gpx'
import { useRouteStore } from '@/entities/route'
import { hashString } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

export function StartPage() {
  const navigate = useNavigate()
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const loadSaved = useRouteStore((s) => s.loadSaved)

  const [parsedGpx, setParsedGpx] = useState<{ data: GpxData; xml: string } | null>(null)
  const [routeName, setRouteName] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<RouteState[]>([])

  useEffect(() => {
    const keys = storageKeys()
    const routes = keys
      .map((k) => storageGet<RouteState>(k))
      .filter((r): r is RouteState => r !== null && !isRouteComplete(r))
    setSavedRoutes(routes)
  }, [])

  function isRouteComplete(r: RouteState): boolean {
    return r.checkpoints.every((cp) => cp.checkedAt !== undefined)
  }

  function handleParsed(data: GpxData, xml: string) {
    setParsedGpx({ data, xml })
    setRouteName(data.name)

    // Check if this GPX was already saved
    const hash = hashString(xml)
    const existing = storageGet<RouteState>(hash)
    if (existing) {
      loadSaved(existing)
      navigate('/route')
    }
  }

  function handleStart() {
    if (!parsedGpx || !routeName.trim()) return
    loadRoute(routeName.trim(), parsedGpx.data.trackPoints, parsedGpx.data.waypoints, parsedGpx.xml)
    navigate('/route')
  }

  function handleContinue(route: RouteState) {
    loadSaved(route)
    navigate('/route')
  }

  const coveredKm = (r: RouteState) => {
    const checked = r.checkpoints.filter((c) => c.checkedAt)
    return checked.length ? checked[checked.length - 1].distanceKm.toFixed(1) : '0'
  }
  const totalKm = (r: RouteState) =>
    (r.checkpoints[r.checkpoints.length - 1]?.distanceKm ?? 0).toFixed(1)

  const canStart = parsedGpx !== null && routeName.trim().length > 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[560px] flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Отметь маршрут — пройди его</p>
        </div>

        {savedRoutes.length > 0 && (
          <div className="flex flex-col gap-2">
            {savedRoutes.map((r) => (
              <button
                key={r.gpxHash}
                onClick={() => handleContinue(r)}
                className="w-full text-left p-4 bg-white rounded-xl border border-gray-200 shadow-sm active:bg-gray-50"
              >
                <p className="font-medium text-gray-900">Продолжить: {r.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Пройдено {coveredKm(r)} из {totalKm(r)} км ·{' '}
                  {r.checkpoints.filter((c) => c.checkedAt).length} из {r.checkpoints.length} точек
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
          <UploadGpx onParsed={handleParsed} />

          {parsedGpx && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Название маршрута</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Введите название"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-800 transition-colors"
          >
            Начать маршрут
          </button>
        </div>
      </div>
    </div>
  )
}
```

```ts
// src/pages/start/index.ts
export { StartPage } from './ui/StartPage'
```

**Step 2: Commit**
```bash
git add src/pages/start/
git commit -m "feat: add start page with GPX upload, name input, saved routes"
```

---

## Task 16: pages/route

**Files:**
- Create: `src/pages/route/ui/RoutePage.tsx`
- Create: `src/pages/route/index.ts`

**Step 1: Implement**
```tsx
// src/pages/route/ui/RoutePage.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteHeader } from '@/widgets/route-header'
import { ProgressPanel } from '@/widgets/progress-panel'
import { RouteMap } from '@/widgets/route-map'
import { CheckpointList } from '@/widgets/checkpoint-list'
import { useRouteStore } from '@/entities/route'

export function RoutePage() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)

  useEffect(() => {
    if (!route) navigate('/', { replace: true })
  }, [route, navigate])

  if (!route) return null

  return (
    <div className="h-screen flex flex-col max-w-[560px] mx-auto bg-white">
      <RouteHeader />
      <ProgressPanel />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="h-[45vh] min-h-[200px]">
          <RouteMap />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CheckpointList />
        </div>
      </div>
    </div>
  )
}
```

```ts
// src/pages/route/index.ts
export { RoutePage } from './ui/RoutePage'
```

**Step 2: Commit**
```bash
git add src/pages/route/
git commit -m "feat: add route page layout (header, progress, map, list)"
```

---

## Task 17: app/ — роутер, провайдеры, точка входа

**Files:**
- Modify: `src/main.tsx`
- Create: `src/app/App.tsx`
- Modify: `src/app/index.css` (или `src/index.css`)

**Step 1: Install react-router-dom**
```bash
npm install react-router-dom
```

**Step 2: Create App.tsx**
```tsx
// src/app/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StartPage } from '@/pages/start'
import { RoutePage } from '@/pages/route'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/route" element={<RoutePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 3: Update main.tsx**
```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

**Step 4: Update index.css — add Tailwind directives**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-tap-highlight-color: transparent;
}

html, body, #root {
  height: 100%;
  overscroll-behavior: none;
}
```

**Step 5: Configure tailwind.config.js**
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

**Step 6: Update index.html title**
```html
<title>Вешка</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**Step 7: Run dev server and verify no errors**
```bash
npm run dev
```
Open http://localhost:5173 — should see start page.

**Step 8: Run all tests**
```bash
npx vitest run
```
Expected: all tests pass.

**Step 9: Commit**
```bash
git add -A
git commit -m "feat: wire up app router and entry point"
```

---

## Task 18: README

**Files:**
- Create: `README.md` (only if not exists)

**Step 1: Create README**
Content: project description, how to get Yandex Maps API key, setup instructions (npm install, .env setup, npm run dev).

**Step 2: Final commit**
```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Final verification

```bash
npm run build          # must succeed with no TS errors
npx vitest run         # all tests pass
```
