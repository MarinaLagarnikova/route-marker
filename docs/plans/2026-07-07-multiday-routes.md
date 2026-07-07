# Multi-Day Routes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show day separators in history drawer and date ranges on route cards when a route spans multiple calendar days.

**Architecture:** Pure rendering change — no data model modifications. `checkedAt` timestamps already store full date info. Two helper functions compute day groups and net walking time from existing checkpoint data. Changes touch exactly two files: `HistoryDrawer.tsx` and `StartPage.tsx`.

**Tech Stack:** React, TypeScript, existing `Checkpoint` model (`checkedAt?: number`)

---

### Task 1: Day grouping helpers in HistoryDrawer

**Files:**
- Modify: `src/features/history/ui/HistoryDrawer.tsx`

**Step 1: Add two helper functions** before the component (no tests needed — pure date math on standard JS `Date`):

```ts
/** Returns 'YYYY-MM-DD' string for grouping by calendar day */
function calendarDay(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns 'D MMMM' in Russian, e.g. '3 июля' */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
```

**Step 2: Add `calcNetWalkTime` helper** — sums walking time per day, excludes nights:

```ts
/** Clean walking time = sum of (last_checkedAt_of_day - first_checkedAt_of_day) per day */
function calcNetWalkTime(checkpoints: Checkpoint[]): number | null {
  const checked = checkpoints.filter((cp) => cp.checkedAt !== undefined)
  if (checked.length < 2) return null

  // group by calendar day
  const byDay = new Map<string, number[]>()
  for (const cp of checked) {
    const day = calendarDay(cp.checkedAt!)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(cp.checkedAt!)
  }

  let total = 0
  for (const timestamps of byDay.values()) {
    const min = Math.min(...timestamps)
    const max = Math.max(...timestamps)
    total += max - min
  }
  return total > 0 ? total : null
}
```

**Step 3: Commit**

```bash
git add src/features/history/ui/HistoryDrawer.tsx
git commit -m "feat: add calendarDay/formatDate/calcNetWalkTime helpers for multi-day history"
```

---

### Task 2: Update HistoryDrawer rendering — Старт date + day separators + net time

**Files:**
- Modify: `src/features/history/ui/HistoryDrawer.tsx`

**Step 1: Detect multi-day and build day-grouped middle checkpoints**

Replace the existing `middle` derivation and `totalDuration` with:

```ts
const checkedMiddle = middle.filter((cp) => cp.checkedAt !== undefined)

// detect multi-day
const allCheckedInRoute = checkpoints.filter((cp) => cp.checkedAt !== undefined)
const uniqueDays = new Set(allCheckedInRoute.map((cp) => calendarDay(cp.checkedAt!)))
const isMultiDay = uniqueDays.size > 1

// net walk time (replaces old totalDuration)
const netWalkTime = allChecked ? calcNetWalkTime(checkpoints) : null
```

**Step 2: Update Старт header** — add date when multi-day:

```tsx
<span className="text-sm font-semibold leading-5 text-[#171717]">
  {start.checkedAt
    ? `Старт в ${formatTime(start.checkedAt)}${isMultiDay ? ` · ${formatDate(start.checkedAt)}` : ''}`
    : 'Старт'}
</span>
```

**Step 3: Replace middle checkpoint loop** — insert day separator when date changes:

```tsx
{middle.length > 0 && (
  <div className="flex flex-col gap-4">
    {middle.map((cp, i) => {
      const isLast = i === middle.length - 1
      const checked = cp.checkedAt !== undefined
      const prev = i > 0 ? middle[i - 1] : start
      const isNewDay =
        isMultiDay &&
        checked &&
        prev.checkedAt !== undefined &&
        calendarDay(cp.checkedAt!) !== calendarDay(prev.checkedAt!)

      return (
        <div key={cp.id}>
          {isNewDay && (
            <div className="py-2 mb-2">
              <span className="text-sm font-semibold text-[#171717]">
                Старт в {formatTime(cp.checkedAt!)} · {formatDate(cp.checkedAt!)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
              {!isLast && (
                <div className="absolute left-[11px] top-[15px] w-px h-[38px] bg-[#e5e7eb]" />
              )}
              <div className="w-1.5 h-1.5 rounded-full bg-[#f3f4f6] ring-1 ring-[#d1d5db]" />
            </div>
            <span
              className={[
                'flex-1 text-sm leading-5',
                checked ? 'text-[#737373]' : 'text-[#0a0a0a]',
              ].join(' ')}
            >
              {cp.distanceKm.toFixed(1)} км
              {checked && cp.checkedAt ? ` · ${formatTime(cp.checkedAt)}` : ''}
            </span>
            <Check
              className={[
                'w-4 h-4 shrink-0',
                checked ? 'text-[#737373]' : 'text-[#d1d5db]',
              ].join(' ')}
            />
          </div>
        </div>
      )
    })}
  </div>
)}
```

**Step 4: Update duration card** — use `netWalkTime` instead of `totalDuration`:

```tsx
{netWalkTime !== null && (
  <div className="mx-4 mt-4 bg-white rounded-[8px] px-4 py-4 flex items-start gap-4">
    <Layers className="w-6 h-6 text-[#0a0a0a] shrink-0 mt-0.5" />
    <p className="text-sm leading-5">
      <span className="font-medium text-[#0a0a0a]">{formatDuration(netWalkTime)} </span>
      <span className="text-[#737373]">
        {isMultiDay ? 'чистого ходового времени' : 'занял весь маршрут'}
      </span>
    </p>
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/features/history/ui/HistoryDrawer.tsx
git commit -m "feat: multi-day history — day separators, date on Старт, net walk time"
```

---

### Task 3: Update route card subtitle on StartPage

**Files:**
- Modify: `src/pages/start/ui/StartPage.tsx`

**Step 1: Update `fmtRouteSubtitle`** to handle multi-day completed routes:

Replace the existing function with:

```ts
function fmtRouteSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  const coveredKm = checked.length ? checked[checked.length - 1].distanceKm : 0
  const isCompleted = checked.length === r.checkpoints.length && r.checkpoints.length > 0

  if (isCompleted && checked.length > 0) {
    const firstTs = checked[0].checkedAt!
    const lastTs = checked[checked.length - 1].checkedAt!
    const firstDay = new Date(firstTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const lastDay = new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const dateStr = firstDay === lastDay ? firstDay : `${firstDay} — ${lastDay}`
    return `${coveredKm.toFixed(1)} км пройдено · ${dateStr}`
  }

  return `${coveredKm.toFixed(1)} км пройдено`
}
```

**Note:** `firstDay === lastDay` compares formatted strings — works correctly for same-day (e.g. both "3 июля") vs multi-day (e.g. "3 июля" vs "4 июля"). No `calendarDay` helper needed here since we only compare display strings.

**Step 2: Commit**

```bash
git add src/pages/start/ui/StartPage.tsx
git commit -m "feat: show date range on multi-day route cards"
```
