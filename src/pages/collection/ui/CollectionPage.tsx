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
          <div className="px-4 pb-3 flex items-baseline gap-2 w-full">
            <h1 className="text-xl font-semibold text-zinc-900 truncate">{collection.name}</h1>
            <span className="text-xl font-semibold text-zinc-400 shrink-0">{collection.totalRoutes}</span>
          </div>
        </div>

        {/* Mini-map */}
        <div className="relative mx-4 mt-8 rounded-2xl overflow-hidden bg-zinc-100" style={{ height: 220 }}>
          <div ref={miniMapRef} className="absolute inset-0" />
          {/* Expand button */}
          <button
            onClick={() => setFullscreenMap(true)}
            className="absolute bottom-3 right-3 w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors z-10"
            aria-label="На весь экран"
          >
            <Expand className="w-4 h-4 text-zinc-900" />
          </button>
        </div>

        {/* Route cards list */}
        <div className="flex flex-col gap-3 px-4 mt-8">
          {collection.routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onTap={() => setSelectedRoute(route)}
            />
          ))}
        </div>

        {/* Attribution */}
        {collection.routes.length > 0 && (
          <div className="mx-4 mt-8 mb-8">
            <CollectionAttribution source={collection.routes[0].source} />
          </div>
        )}
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
      className="w-full text-left bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col gap-2 active:bg-zinc-50 transition-colors"
    >
      {/* Row 1: name + distance */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 flex-1 min-w-0">
          {route.name}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <SportShoe className="w-4 h-4 text-zinc-900" />
          <span className="text-sm font-normal text-zinc-900 whitespace-nowrap">
            {route.distanceKm} км
          </span>
        </div>
      </div>

      {/* Bottom section: left col + center + thumbnail */}
      <div className="flex items-stretch gap-3 h-12">
        {/* Left: difficulty + duration */}
        <div className="flex-1 flex flex-col justify-between gap-[6px]">
          <DifficultyBadge difficulty={route.difficulty} />
          <div className="flex items-center gap-[6px]">
            <Timer size={14} strokeWidth={1.5} className="text-zinc-500" />
            <span className="text-sm font-normal text-zinc-500 whitespace-nowrap leading-normal">{route.durationLabel}</span>
          </div>
        </div>

        {/* Center: elevation gain + profile placeholder */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-normal text-zinc-500 whitespace-nowrap leading-normal">{route.elevationGainM} м</span>
          </div>
          <div className="h-8 bg-zinc-100 rounded-lg" />
        </div>

        {/* Right: track thumbnail — flex-1 wrapper, square inside */}
        <div className="flex-1 flex items-center justify-end">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 shrink-0" />
        </div>
      </div>
    </button>
  )
}

function CollectionAttribution({ source }: { source: LibraryRoute['source'] }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 active:opacity-70 transition-opacity no-underline"
    >
      {/* Logo */}
      {source.logoUrl ? (
        <img
          src={source.logoUrl}
          alt={source.name}
          className="object-contain shrink-0"
          style={{ width: 43, height: 38 }}
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-zinc-100 shrink-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-zinc-500">{source.name[0]}</span>
        </div>
      )}

      {/* Text */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm font-medium text-zinc-900 leading-snug">{source.name}</span>
        <span className="text-xs font-normal text-zinc-500 leading-5 tracking-normal">Маршруты предоставлены</span>
      </div>

      {/* Arrow button */}
      <div className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white shrink-0">
        <ArrowUpRight className="w-4 h-4 text-zinc-900" />
      </div>
    </a>
  )
}
