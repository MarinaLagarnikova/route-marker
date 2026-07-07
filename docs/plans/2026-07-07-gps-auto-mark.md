# GPS Auto-Mark Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically mark checkpoints when the user's GPS position is within 30m of the next checkpoint for 3 consecutive seconds, with accuracy filtering and manual-first constraint.

**Architecture:** Lift GPS watch from `RouteMap` to `RoutePage`. Create `useGpsAutoMark` hook in `features/mark-checkpoint`. `RouteMap` receives `userPos` as a prop instead of owning the watch. Auto-mark is disabled until first checkpoint is manually marked (both linear and circular routes).

**Tech Stack:** React hooks, `navigator.geolocation.watchPosition`, `haversineKm` from `shared/lib/geo`

---

### Task 1: Lift GPS watch out of RouteMap — accept userPos as prop

**Files:**
- Modify: `src/widgets/route-map/ui/RouteMap.tsx`

**Step 1: Add `userPos` prop, remove internal GPS state and watch**

Change the component signature and remove the two GPS-related `useEffect`s:

```tsx
interface Props {
  userPos: LatLon | null
}

export function RouteMap({ userPos }: Props) {
  // remove: const [userPos, setUserPos] = useState<LatLon | null>(null)
  // remove: GPS watch useEffect (lines 96-104)
  // keep: useEffect that calls adapterRef.current?.updateUserPosition(userPos)
```

The `updateUserPosition` effect stays exactly as-is — it now reacts to the prop instead of local state.

Also remove the `useState` import if `userPos` was the only state (keep `useRef`, `useEffect`). Actually `mapError` and `mapReady` still use `useState` — keep it.

After edit, `RouteMap` should:
- Accept `userPos: LatLon | null` prop
- Still call `adapterRef.current?.updateUserPosition(userPos)` in a `useEffect([userPos])`
- No longer own `watchPosition`

**Step 2: Run TypeScript**

```bash
cd "/Users/marinalagarnikova/Desktop/Dev/route marker" && npx tsc --noEmit
```

Expected: errors about `RouteMap` missing prop in `RoutePage.tsx` — that's fine, we fix it next task.

**Step 3: Commit**

```bash
git add src/widgets/route-map/ui/RouteMap.tsx
git commit -m "refactor: RouteMap accepts userPos prop instead of owning GPS watch"
```

---

### Task 2: Add GPS watch to RoutePage, pass userPos to RouteMap

**Files:**
- Modify: `src/pages/route/ui/RoutePage.tsx`

**Step 1: Add GPS watch state and effect**

```tsx
import { useEffect, useState, useRef } from 'react'
// add LatLon import
import type { LatLon } from '@/shared/lib/geo'

// inside RoutePage, after existing state:
const [userPos, setUserPos] = useState<LatLon | null>(null)

useEffect(() => {
  if (!navigator.geolocation) return
  const id = navigator.geolocation.watchPosition(
    (pos) => setUserPos({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    }),
    () => setUserPos(null),
    { enableHighAccuracy: true, maximumAge: 5000 }
  )
  return () => navigator.geolocation.clearWatch(id)
}, [])
```

**Step 2: Pass userPos to RouteMap**

```tsx
<RouteMap userPos={userPos} />
```

**Step 3: Run TypeScript — must be zero errors**

```bash
cd "/Users/marinalagarnikova/Desktop/Dev/route marker" && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/route/ui/RoutePage.tsx
git commit -m "feat: lift GPS watch to RoutePage, pass userPos to RouteMap"
```

---

### Task 3: Create useGpsAutoMark hook

**Files:**
- Create: `src/features/mark-checkpoint/lib/useGpsAutoMark.ts`

**Step 1: Create the hook**

```ts
import { useEffect, useRef } from 'react'
import { haversineKm } from '@/shared/lib/geo'
import { getLastChecked } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'

const RADIUS_KM = 0.030       // 30 metres
const ACCURACY_MAX_M = 50     // ignore positions worse than 50m
const DWELL_MS = 3000         // must stay in radius for 3 seconds

interface GpsPosition extends LatLon {
  accuracy: number
}

interface Params {
  userPos: GpsPosition | null
  checkpoints: Checkpoint[]
  isCircular: boolean
  circularPhase: number
  markCheckpoint: (index: number) => void
}

export function useGpsAutoMark({
  userPos,
  checkpoints,
  isCircular,
  circularPhase,
  markCheckpoint,
}: Params) {
  const candidateIdxRef = useRef<number | null>(null)
  const candidateSinceRef = useRef<number>(0)

  useEffect(() => {
    // Disabled until first manual mark
    const lastIdx = getLastChecked(checkpoints)
    if (isCircular && circularPhase < 3) return
    if (!isCircular && lastIdx < 0) return

    // No GPS or bad accuracy
    if (!userPos || userPos.accuracy > ACCURACY_MAX_M) {
      candidateIdxRef.current = null
      return
    }

    // Next checkpoint to mark
    const nextIdx = lastIdx + 1
    if (nextIdx >= checkpoints.length) return
    const next = checkpoints[nextIdx]
    if (!next || next.checkedAt !== undefined) return

    const dist = haversineKm(userPos, next)

    if (dist > RADIUS_KM) {
      candidateIdxRef.current = null
      return
    }

    const now = Date.now()

    if (candidateIdxRef.current !== nextIdx) {
      // Entered radius for this checkpoint
      candidateIdxRef.current = nextIdx
      candidateSinceRef.current = now
      return
    }

    // Already a candidate — check dwell time
    if (now - candidateSinceRef.current >= DWELL_MS) {
      markCheckpoint(nextIdx)
      candidateIdxRef.current = null
    }
  }, [userPos, checkpoints, isCircular, circularPhase, markCheckpoint])
}
```

**Note:** `userPos` from `watchPosition` doesn't include `accuracy` in the `LatLon` type — we'll pass the full position object with accuracy from `RoutePage`. The hook parameter type uses `GpsPosition` which extends `LatLon`.

**Step 2: Run TypeScript**

```bash
cd "/Users/marinalagarnikova/Desktop/Dev/route marker" && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add src/features/mark-checkpoint/lib/useGpsAutoMark.ts
git commit -m "feat: add useGpsAutoMark hook — 30m radius, 50m accuracy filter, 3s dwell"
```

---

### Task 4: Wire useGpsAutoMark into RoutePage

**Files:**
- Modify: `src/pages/route/ui/RoutePage.tsx`

**Step 1: Extend userPos state to include accuracy**

Change the GPS watch state to store accuracy alongside position:

```tsx
// Replace LatLon with extended type inline
const [userPos, setUserPos] = useState<(LatLon & { accuracy: number }) | null>(null)

// In watchPosition callback:
(pos) => setUserPos({
  lat: pos.coords.latitude,
  lon: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
})
```

**Step 2: Import and call the hook**

```tsx
import { useGpsAutoMark } from '@/features/mark-checkpoint'
// (we'll export it in step 3)

const markCheckpoint = useRouteStore((s) => s.markCheckpoint)

useGpsAutoMark({
  userPos,
  checkpoints: route?.checkpoints ?? [],
  isCircular: route?.isCircular ?? false,
  circularPhase: route?.circularPhase ?? 1,
  markCheckpoint,
})
```

Place the hook call after the `celebratedRef` effect, before the `if (!route) return null` guard. Since the hook receives `route?.checkpoints ?? []` it is safe to call unconditionally.

**Step 3: Pass userPos to RouteMap (strip accuracy — RouteMap expects LatLon)**

```tsx
<RouteMap userPos={userPos ? { lat: userPos.lat, lon: userPos.lon } : null} />
```

**Step 4: Export hook from features/mark-checkpoint**

In `src/features/mark-checkpoint/index.ts`, add:

```ts
export { useGpsAutoMark } from './lib/useGpsAutoMark'
```

**Step 5: Run TypeScript — must be zero errors**

```bash
cd "/Users/marinalagarnikova/Desktop/Dev/route marker" && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/pages/route/ui/RoutePage.tsx src/features/mark-checkpoint/index.ts
git commit -m "feat: wire GPS auto-mark into RoutePage"
```
