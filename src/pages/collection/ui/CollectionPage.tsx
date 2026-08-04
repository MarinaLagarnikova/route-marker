import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, FolderOpen, Map as MapIcon, SportShoe, Timer } from 'lucide-react'
import { Drawer } from '@/shared/ui/drawer'
import { fetchCollection } from '@/shared/lib/library-api'
import { useLibraryStore } from '@/entities/library-route'
import type { FavoriteEntry } from '@/entities/library-route'
import { DifficultyBadge } from '@/entities/library-route/ui/DifficultyBadge'
import { TrackThumbnail } from '@/entities/library-route/ui/TrackThumbnail'
import { CollectionMap } from '@/widgets/collection-map'
import { RouteDetailDrawer } from '@/widgets/route-detail-drawer'
import type { LibraryCollection, LibraryRoute } from '@/entities/library-route'
import { ElevationSparkline } from '@/shared/ui/elevation-sparkline'

type SortOrder = 'short' | 'long'

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'short', label: 'Короткие' },
  { value: 'long',  label: 'Длинные' },
]

const SORT_TRIGGER_LABEL: Record<SortOrder, string> = {
  short: 'Сначала короткие',
  long:  'Сначала длинные',
}

function sortRoutes(routes: LibraryRoute[], order: SortOrder): LibraryRoute[] {
  const copy = [...routes]
  return order === 'short'
    ? copy.sort((a, b) => a.distanceKm - b.distanceKm)
    : copy.sort((a, b) => b.distanceKm - a.distanceKm)
}

function buildFavoritesCollection(
  favorites: FavoriteEntry[],
  cache: Record<string, LibraryCollection>
): LibraryCollection {
  const favoriteIds = new Set(favorites.map((f) => f.id))
  const all = Object.values(cache).flatMap((c) => c.routes)
  const routes = all.filter((r) => favoriteIds.has(r.id))
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

  const [fullscreenMap, setFullscreenMap] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<LibraryRoute | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('short')
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const routeCacheRef = useRef<Map<string, LibraryRoute>>(new Map())
  const prevFavoritesRef = useRef<FavoriteEntry[]>(favorites)

  useEffect(() => {
    if (!id) return
    if (id === 'favorites') {
      if (favorites.length === 0) {
        setCollection(buildFavoritesCollection(favorites, collectionsCache))
        setLoading(false)
        return
      }
      // Load any collections that aren't cached yet
      const regionIds = [...new Set(favorites.map((f) => f.regionId))]
      const missingIds = regionIds.filter((rid) => !collectionsCache[rid])
      if (missingIds.length === 0) {
        setCollection(buildFavoritesCollection(favorites, collectionsCache))
        setLoading(false)
        return
      }
      setLoading(true)
      Promise.all(
        missingIds.map((rid) =>
          fetchCollection(rid).then((col) => setCollectionCache(rid, col))
        )
      )
        .catch(() => setError('Не удалось загрузить избранное'))
        .finally(() => setLoading(false))
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

  // Keep favorites collection reactive to favorites and cache changes
  useEffect(() => {
    if (id === 'favorites') {
      setCollection(buildFavoritesCollection(favorites, collectionsCache))
    }
  }, [id, favorites, collectionsCache])

  // Cache all seen routes so we can render them during fade-out animation
  useEffect(() => {
    if (collection) {
      collection.routes.forEach((r) => routeCacheRef.current.set(r.id, r))
    }
  }, [collection])

  // Detect removed favorites and trigger fade-out animation
  useEffect(() => {
    if (id !== 'favorites') return
    const prev = prevFavoritesRef.current
    const currentIds = new Set(favorites.map((f) => f.id))
    const removed = prev.map((f) => f.id).filter((fid) => !currentIds.has(fid))
    prevFavoritesRef.current = favorites
    if (removed.length === 0) return
    setRemovingIds((current) => new Set([...current, ...removed]))
    const timer = setTimeout(() => {
      setRemovingIds((current) => {
        const next = new Set(current)
        removed.forEach((rid) => next.delete(rid))
        return next
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [favorites, id])

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
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white">
          {/* Top row */}
          <div className="px-4 pt-6 pb-6 w-full flex items-center">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors"
              aria-label="На главную"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-900" />
            </button>
          </div>
          {/* Title */}
          <div className="px-4 flex items-baseline gap-2 w-full">
            <h1 className="text-xl font-semibold text-zinc-900 truncate">{collection.name}</h1>
            <span className="text-xl font-semibold text-zinc-400 shrink-0">{collection.totalRoutes}</span>
          </div>
        </div>

        {/* Show on map button — hidden for favorites */}
        {id !== 'favorites' && (
          <div className="px-4 mt-3">
            <button
              onClick={() => setFullscreenMap(true)}
              className="w-full h-9 flex items-center justify-center gap-2 border border-zinc-200 rounded-[12px] bg-white active:bg-zinc-50 transition-colors"
            >
              <MapIcon className="w-5 h-5 text-zinc-900" />
              <span className="text-sm font-normal text-zinc-900">Показать на карте</span>
            </button>
          </div>
        )}

        {/* Route cards list */}
        <div className="flex flex-col gap-3 px-4 mt-8">
          {collection.routes.length === 0 && removingIds.size === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 bg-zinc-50 rounded-2xl px-6">
              <div className="w-12 h-12 flex items-center justify-center bg-zinc-100 rounded-2xl">
                <FolderOpen className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-base font-semibold text-zinc-900">Пока здесь пусто</p>
              <p className="text-sm text-zinc-500 text-center leading-[1.4]">
                Открывайте маршруты из подборок и добавляйте их в избранное
              </p>
            </div>
          ) : (
            <>
              {collection.routes.length > 0 && (
                <button
                  onClick={() => setSortDrawerOpen(true)}
                  className="flex items-center gap-2 self-start active:opacity-70 transition-opacity"
                >
                  <ArrowUpDown className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-500">{SORT_TRIGGER_LABEL[sortOrder]}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>
              )}

              {[
                ...sortRoutes(collection.routes, sortOrder),
                ...[...removingIds]
                  .filter((rid) => !collection.routes.some((r) => r.id === rid))
                  .map((rid) => routeCacheRef.current.get(rid))
                  .filter((r): r is LibraryRoute => r !== undefined),
              ].map((route) => (
                <div
                  key={route.id}
                  className={`transition-all duration-300 ease-out overflow-hidden ${
                    removingIds.has(route.id) ? 'opacity-0 max-h-0' : 'opacity-100 max-h-96'
                  }`}
                >
                  <RouteCard
                    route={route}
                    onTap={() => setSelectedRoute(route)}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="mb-8" />
      </div>

      {/* Fullscreen map overlay */}
      {fullscreenMap && (
        <CollectionMap
          routes={collection.routes}
          onClose={() => setFullscreenMap(false)}
        />
      )}

      {/* Route detail drawer */}
      {selectedRoute && (
        <RouteDetailDrawer
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}

      {/* Sort drawer */}
      {sortDrawerOpen && (
        <Drawer onClose={() => setSortDrawerOpen(false)}>
          <div className="flex flex-col gap-2 p-4 pb-8">
            <p className="text-sm font-semibold text-zinc-900">Показать сначала</p>
            <div className="flex flex-col">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortOrder(opt.value); setSortDrawerOpen(false) }}
                  className={`flex items-center justify-between px-2 py-3 rounded-[6px] transition-colors ${sortOrder === opt.value ? 'bg-zinc-100' : 'active:bg-zinc-50'}`}
                >
                  <span className="text-sm text-zinc-900">{opt.label}</span>
                  {sortOrder === opt.value && <Check className="w-4 h-4 text-zinc-900" />}
                </button>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

function RouteCard({
  route,
  onTap,
}: {
  route: LibraryRoute
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col gap-3 active:bg-zinc-50 transition-colors"
    >
      {/* Row 1: name + distance */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 flex-1 min-w-0">
          {route.name}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <SportShoe className="w-4 h-4 text-zinc-900" />
          <span className="text-sm font-normal text-zinc-900 whitespace-nowrap">
            {Math.round(route.distanceKm)} км
          </span>
        </div>
      </div>

      {/* Bottom section: left col + center + thumbnail */}
      <div className="flex items-stretch gap-3 h-12">
        {/* Left: difficulty + duration */}
        <div className="flex-1 flex flex-col justify-between gap-[6px]">
          <DifficultyBadge difficulty={route.difficulty} />
          <div className="flex items-center gap-[6px]">
            <Timer size={16} strokeWidth={1.5} className="text-zinc-500" />
            <span className="text-sm font-normal text-zinc-500 whitespace-nowrap leading-normal">{route.durationLabel}</span>
          </div>
        </div>

        {/* Center: elevation gain + profile placeholder */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-normal text-zinc-500 whitespace-nowrap leading-normal">
              {route.trackSimplified.some((p) => p.ele !== undefined) ? '' : '~'}{route.elevationGainM} м
            </span>
          </div>
          <div className="h-8 rounded-lg overflow-hidden">
            <ElevationSparkline points={route.trackSimplified} />
          </div>
        </div>

        {/* Right: track thumbnail */}
        <div className="flex-1 flex items-center justify-end">
          <TrackThumbnail track={route.trackSimplified} size={48} trackSize={30} />
        </div>
      </div>
    </button>
  )
}
