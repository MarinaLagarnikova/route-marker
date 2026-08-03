# Library Data Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Заменить хардкоженные заглушки в `data.ts` на динамическую загрузку из `public/tracks/{collection-id}/collection.json` + ленивую загрузку GPX-треков.

**Architecture:** `CollectionPage` загружает метаданные + `trackSimplified` из JSON при маунте. `RouteDetailDrawer` загружает полный GPX только при открытии. Кеш хранится в `useLibraryStore`. Скрипт `scripts/simplify-gpx.ts` помогает готовить данные.

**Tech Stack:** React 18, TypeScript strict, Zustand, существующий `parseGpx` из `shared/lib/gpx`, `fetch` API.

---

### Task 1: Обновить тип `LibraryRoute` в `model.ts`

**Files:**
- Modify: `src/entities/library-route/model.ts`

**Step 1: Добавить поле `gpx` и сделать `track` опциональным**

```ts
export interface LibraryRoute {
  id: string
  name: string
  region: { id: string; name: string }
  distanceKm: number
  durationLabel: string
  difficulty: Difficulty
  elevationGainM: number
  type: RouteType
  nearestSettlement?: string
  description: string
  highlights?: string[]          // новое: ключевые факты маршрута
  gpx?: string                   // новое: имя GPX-файла в папке коллекции
  source: RouteSource
  track?: GeoPoint[]             // было обязательным — теперь опциональное
  trackSimplified: GeoPoint[]
}
```

**Step 2: Убедиться что TypeScript не ломается**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Ожидаем ошибки — они будут исправлены в следующих тасках.

**Step 3: Commit**

```bash
git add src/entities/library-route/model.ts
git commit -m "feat: make track optional and add gpx/highlights fields to LibraryRoute"
```

---

### Task 2: Почистить `data.ts` — убрать заглушки

**Files:**
- Modify: `src/entities/library-route/data.ts`
- Modify: `src/entities/library-route/index.ts`

**Step 1: Удалить из `data.ts`:**
- Всю константу `MOSCOW_ROUTES` (большой массив с фейковыми треками)
- Константу `LIBRARY_COLLECTIONS`
- Функции `getCollection` и `getRoute`
- Импорт `LibraryCollection`, `LibraryRoute`, `RouteSource` (оставить только то что нужно для `COLLECTION_CARD_LIST`)

Оставить только:
```ts
import col2 from '@/assets/collections/col-2.jpg'
// ... остальные col3..col8

export interface CollectionCardMeta {
  id: string
  name: string
  count: number
  imageUrl?: string
}

export const COLLECTION_CARD_LIST: CollectionCardMeta[] = [
  { id: 'favorites', name: 'Избранное', count: 0 },
  { id: 'moscow-region',   name: 'Москва и область',           count: 27, imageUrl: col2 },
  { id: 'central-russia',  name: 'Центральная Россия',          count: 25, imageUrl: col3 },
  { id: 'caucasus-crimea', name: 'Кавказ и Крым',               count: 17, imageUrl: col4 },
  { id: 'murmansk-region', name: 'Мурманская область',          count: 13, imageUrl: col5 },
  { id: 'siberia',         name: 'Сибирь',                      count: 11, imageUrl: col6 },
  { id: 'spb-karelia',     name: 'Санкт-Петербург и Карелия',   count: 9,  imageUrl: col7 },
  { id: 'ural',            name: 'Урал',                        count: 8,  imageUrl: col8 },
]
```

**Step 2: Обновить `index.ts`**

```ts
export type { GeoPoint, LibraryRoute, LibraryCollection, Difficulty, RouteType, RouteSource } from './model'
export { COLLECTION_CARD_LIST } from './data'
export type { CollectionCardMeta } from './data'
export { useLibraryStore } from './store'
```

**Step 3: Commit**

```bash
git add src/entities/library-route/data.ts src/entities/library-route/index.ts
git commit -m "feat: remove stub route data, keep only COLLECTION_CARD_LIST"
```

---

### Task 3: Добавить кеш коллекций в `useLibraryStore`

**Files:**
- Modify: `src/entities/library-route/store.ts`

**Step 1: Расширить стор**

```ts
import { create } from 'zustand'
import { storageGet, storageSet } from '@/shared/lib/storage'
import type { LibraryCollection } from './model'

const FAVORITES_KEY = 'library_favorites'

interface LibraryStore {
  favorites: string[]
  toggleFavorite(routeId: string): void
  isFavorite(routeId: string): boolean

  // Кеш загруженных коллекций (живёт только в памяти, не в localStorage)
  collectionsCache: Record<string, LibraryCollection>
  setCollectionCache(id: string, collection: LibraryCollection): void
  getCollectionCache(id: string): LibraryCollection | undefined
}

function loadFavorites(): string[] {
  return storageGet<string[]>(FAVORITES_KEY) ?? []
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  favorites: loadFavorites(),

  toggleFavorite(routeId: string) {
    const current = get().favorites
    const next = current.includes(routeId)
      ? current.filter((id) => id !== routeId)
      : [...current, routeId]
    storageSet(FAVORITES_KEY, next)
    set({ favorites: next })
  },

  isFavorite(routeId: string) {
    return get().favorites.includes(routeId)
  },

  collectionsCache: {},

  setCollectionCache(id: string, collection: LibraryCollection) {
    set((s) => ({ collectionsCache: { ...s.collectionsCache, [id]: collection } }))
  },

  getCollectionCache(id: string) {
    return get().collectionsCache[id]
  },
}))
```

**Step 2: Commit**

```bash
git add src/entities/library-route/store.ts
git commit -m "feat: add in-memory collections cache to useLibraryStore"
```

---

### Task 4: Создать `shared/lib/library-api`

**Files:**
- Create: `src/shared/lib/library-api/index.ts`

**Step 1: Создать модуль**

```ts
import { parseGpx } from '@/shared/lib/gpx'
import type { LibraryCollection, GeoPoint } from '@/entities/library-route'

/**
 * Загружает метаданные коллекции + trackSimplified для каждого маршрута.
 * Полные GPX-треки НЕ загружаются здесь.
 */
export async function fetchCollection(id: string): Promise<LibraryCollection> {
  const res = await fetch(`/tracks/${id}/collection.json`)
  if (!res.ok) throw new Error(`Не удалось загрузить коллекцию: ${id}`)
  const data = await res.json()
  return data as LibraryCollection
}

/**
 * Загружает и парсит полный GPX-трек маршрута.
 * Возвращает массив точек из первого trkpt-сегмента.
 */
export async function fetchRouteGpx(
  collectionId: string,
  gpxFile: string
): Promise<GeoPoint[]> {
  const res = await fetch(`/tracks/${collectionId}/${gpxFile}`)
  if (!res.ok) throw new Error(`Не удалось загрузить трек: ${gpxFile}`)
  const xml = await res.text()
  const parsed = parseGpx(xml)
  return parsed.trackPoints.map((p) => ({ lat: p.lat, lon: p.lon }))
}
```

**Step 2: Проверить что TypeScript доволен**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/shared/lib/library-api/index.ts
git commit -m "feat: add library-api with fetchCollection and fetchRouteGpx"
```

---

### Task 5: Обновить `CollectionPage` — async загрузка

**Files:**
- Modify: `src/pages/collection/ui/CollectionPage.tsx`

**Step 1: Заменить синхронный `getCollection` на async `fetchCollection`**

Логика:
- При маунте вызвать `fetchCollection(id)`, показывать скелетон пока грузится
- Для `id === 'favorites'`: `buildFavoritesCollection` берёт данные из `collectionsCache` стора
- Загруженную коллекцию класть в кеш через `setCollectionCache`
- Карте передавать `trackSimplified` как `track` (для `initCollectionMap` / `initStartMarkersMap`)

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, Expand, SportShoe, Timer } from 'lucide-react'
import { initPlainMap, initCollectionMap } from '@/shared/lib/map-adapter/library-map'
import { fetchCollection } from '@/shared/lib/library-api'
import { useLibraryStore } from '@/entities/library-route'
import { DifficultyBadge } from '@/entities/library-route/ui/DifficultyBadge'
import { CollectionMap } from '@/widgets/collection-map'
import { RouteDetailDrawer } from '@/widgets/route-detail-drawer'
import type { LibraryCollection, LibraryRoute } from '@/entities/library-route'
import type { LibraryMapHandle } from '@/shared/lib/map-adapter/library-map'

function buildFavoritesCollection(
  favorites: string[],
  cache: Record<string, LibraryCollection>
): LibraryCollection {
  const all = Object.values(cache).flatMap((c) => c.routes)
  const routes = all.filter((r) => favorites.includes(r.id))
  return { id: 'favorites', name: 'Избранное', totalRoutes: routes.length, routes }
}

export function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const favorites = useLibraryStore((s) => s.favorites)
  const collectionsCache = useLibraryStore((s) => s.collectionsCache)
  const setCollectionCache = useLibraryStore((s) => s.setCollectionCache)

  const [collection, setCollection] = useState<LibraryCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const miniMapRef = useRef<HTMLDivElement>(null)
  const mapHandleRef = useRef<LibraryMapHandle | null>(null)
  const [fullscreenMap, setFullscreenMap] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<LibraryRoute | null>(null)

  // Загружаем коллекцию
  useEffect(() => {
    if (!id) return
    if (id === 'favorites') {
      setCollection(buildFavoritesCollection(favorites, collectionsCache))
      setLoading(false)
      return
    }
    const cached = collectionsCache[id]
    if (cached) {
      setCollection(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchCollection(id)
      .then((col) => {
        setCollectionCache(id, col)
        setCollection(col)
      })
      .catch(() => setError('Не удалось загрузить подборку'))
      .finally(() => setLoading(false))
  }, [id])

  // Инициализируем карту когда коллекция загружена
  useEffect(() => {
    if (!miniMapRef.current || !collection) return
    let handle: LibraryMapHandle | null = null

    if (collection.routes.length === 0) {
      initPlainMap(miniMapRef.current).then((h) => {
        handle = h
        mapHandleRef.current = h
      })
    } else {
      const mapRoutes = collection.routes.map((r) => ({
        id: r.id,
        track: r.trackSimplified,
        name: r.name,
      }))
      initCollectionMap(miniMapRef.current, mapRoutes, (routeId) => {
        const found = collection.routes.find((r) => r.id === routeId)
        if (found) setSelectedRoute(found)
      }, false).then((h) => {
        handle = h
        mapHandleRef.current = h
      })
    }

    return () => {
      handle?.destroy()
      mapHandleRef.current = null
    }
  }, [collection])

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center max-w-[560px] mx-auto">
        <p className="text-sm text-zinc-400">Загрузка…</p>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="h-dvh flex items-center justify-center max-w-[560px] mx-auto">
        <p className="text-sm text-zinc-500">{error ?? 'Подборка не найдена'}</p>
      </div>
    )
  }

  return (
    // ... остальной JSX остаётся без изменений
    // коллекция теперь из стейта, а не из синхронного getCollection
    <>{/* existing JSX */}</>
  )
}
```

> Примечание: JSX-разметку (карточки, карта, drawer) оставить без изменений. Менять только источник данных и инициализацию карты.

**Step 2: Убедиться что компилируется**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/pages/collection/ui/CollectionPage.tsx
git commit -m "feat: CollectionPage loads collection async from JSON, uses trackSimplified for map"
```

---

### Task 6: Обновить `RouteDetailDrawer` — ленивая загрузка GPX

**Files:**
- Modify: `src/widgets/route-detail-drawer/ui/RouteDetailDrawer.tsx`

**Step 1: Добавить загрузку GPX при открытии**

Текущий код инициализирует карту с `route.track` — теперь `track` опциональный.
Новая логика:
1. Если `route.track` уже есть — использовать его (обратная совместимость)
2. Если есть `route.gpx` и `route.region.id` — загрузить через `fetchRouteGpx`
3. Пока грузится — показать плейсхолдер вместо карты

```tsx
import { fetchRouteGpx } from '@/shared/lib/library-api'
import type { GeoPoint } from '@/entities/library-route'

// Внутри компонента RouteDetailDrawer:
const [gpxTrack, setGpxTrack] = useState<GeoPoint[] | null>(route.track ?? null)
const [gpxLoading, setGpxLoading] = useState(!route.track && !!route.gpx)

useEffect(() => {
  if (route.track) {
    setGpxTrack(route.track)
    return
  }
  if (!route.gpx) return

  setGpxLoading(true)
  fetchRouteGpx(route.region.id, route.gpx)
    .then(setGpxTrack)
    .catch(() => setGpxTrack(null))
    .finally(() => setGpxLoading(false))
}, [route.id])

// Карта инициализируется только когда gpxTrack готов:
useEffect(() => {
  if (!mapContainerRef.current || !gpxTrack) return
  let handle: LibraryMapHandle | null = null

  initLibraryMap(mapContainerRef.current, gpxTrack).then((h) => {
    handle = h
    mapHandleRef.current = h
  })

  return () => {
    handle?.destroy()
    mapHandleRef.current = null
  }
}, [gpxTrack])
```

В JSX для карты:
```tsx
<div ref={mapContainerRef} className="w-full rounded-2xl overflow-hidden bg-zinc-100" style={{ height: 300 }}>
  {gpxLoading && (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-sm text-zinc-400">Загрузка трека…</p>
    </div>
  )}
</div>
```

**Step 2: Commit**

```bash
git add src/widgets/route-detail-drawer/ui/RouteDetailDrawer.tsx
git commit -m "feat: RouteDetailDrawer lazy-loads GPX track on open"
```

---

### Task 7: Скрипт `scripts/simplify-gpx.ts`

**Files:**
- Create: `scripts/simplify-gpx.ts`

**Step 1: Написать скрипт**

```ts
#!/usr/bin/env tsx
/**
 * Упрощает GPX-трек алгоритмом Рамера-Дугласа-Пёкера.
 * Использование: npx tsx scripts/simplify-gpx.ts ./path/to/file.gpx [epsilon]
 * epsilon — порог упрощения в градусах (по умолчанию 0.001 ≈ ~100м)
 * Выводит JSON-массив { lat, lon } для вставки в trackSimplified
 */

import { readFileSync } from 'fs'

interface Point { lat: number; lon: number }

function parseGpxPoints(xml: string): Point[] {
  const points: Point[] = []
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]) })
  }
  // fallback: try lon before lat
  if (points.length === 0) {
    const regex2 = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"/g
    while ((m = regex2.exec(xml)) !== null) {
      points.push({ lat: parseFloat(m[2]), lon: parseFloat(m[1]) })
    }
  }
  return points
}

function perpendicularDistance(p: Point, start: Point, end: Point): number {
  const dx = end.lon - start.lon
  const dy = end.lat - start.lat
  if (dx === 0 && dy === 0) {
    return Math.hypot(p.lon - start.lon, p.lat - start.lat)
  }
  const t = ((p.lon - start.lon) * dx + (p.lat - start.lat) * dy) / (dx * dx + dy * dy)
  const nearLon = start.lon + t * dx
  const nearLat = start.lat + t * dy
  return Math.hypot(p.lon - nearLon, p.lat - nearLat)
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points
  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon)
    const right = rdp(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[points.length - 1]]
}

const filePath = process.argv[2]
const epsilon = parseFloat(process.argv[3] ?? '0.001')

if (!filePath) {
  console.error('Usage: npx tsx scripts/simplify-gpx.ts <file.gpx> [epsilon]')
  process.exit(1)
}

const xml = readFileSync(filePath, 'utf-8')
const points = parseGpxPoints(xml)

if (points.length === 0) {
  console.error('Не найдено точек trkpt в файле')
  process.exit(1)
}

const simplified = rdp(points, epsilon)
console.error(`Исходных точек: ${points.length}, после упрощения: ${simplified.length}`)
console.log(JSON.stringify(simplified, null, 2))
```

**Step 2: Проверить что скрипт работает (нужен любой GPX-файл)**

```bash
npx tsx scripts/simplify-gpx.ts ./some-test.gpx
```

Ожидаем: вывод JSON-массива точек в stdout, статистика в stderr.

**Step 3: Commit**

```bash
git add scripts/simplify-gpx.ts
git commit -m "feat: add simplify-gpx script using Ramer-Douglas-Peucker algorithm"
```

---

### Task 8: Создать структуру папок и пример `collection.json`

**Files:**
- Create: `public/tracks/moscow-region/collection.json` (шаблон с 0 маршрутов)

**Step 1: Создать заглушку коллекции**

```json
{
  "id": "moscow-region",
  "name": "Москва и область",
  "totalRoutes": 0,
  "routes": []
}
```

Аналогично создать пустые `collection.json` для остальных 6 коллекций:
- `public/tracks/central-russia/collection.json`
- `public/tracks/caucasus-crimea/collection.json`
- `public/tracks/murmansk-region/collection.json`
- `public/tracks/siberia/collection.json`
- `public/tracks/spb-karelia/collection.json`
- `public/tracks/ural/collection.json`

**Step 2: Убедиться что `CollectionPage` не падает с пустой коллекцией**

Запустить `npm run dev`, открыть любую коллекцию, увидеть пустой список без ошибок.

**Step 3: Commit**

```bash
git add public/tracks/
git commit -m "feat: add empty collection.json stubs for all 7 regions"
```

---

## После имплементации: добавление реального маршрута

Воркфлоу для добавления маршрута из rutrail.org:

1. Скачать GPX с сайта → положить в `public/tracks/{collection-id}/route-slug.gpx`
2. Запустить скрипт: `npx tsx scripts/simplify-gpx.ts public/tracks/moscow-region/route.gpx > /tmp/simplified.json`
3. Добавить запись в `collection.json`:
   ```json
   {
     "id": "route-slug",
     "name": "Название маршрута",
     "gpx": "route-slug.gpx",
     "region": { "id": "moscow-region", "name": "Москва и область" },
     "distanceKm": 42.5,
     "durationLabel": "2—3 дня",
     "difficulty": "medium",
     "elevationGainM": 380,
     "type": "loop",
     "nearestSettlement": "Населённый пункт",
     "description": "1–2 предложения о характере маршрута.",
     "highlights": ["лес", "река", "нет бродов"],
     "source": {
       "name": "RuTrail",
       "url": "https://rutrail.org/...",
       "logoUrl": "/tracks/rutrail-logo.png"
     },
     "trackSimplified": [ /* вставить из /tmp/simplified.json */ ]
   }
   ```
4. Обновить `count` в `COLLECTION_CARD_LIST` в `data.ts`
