import { useEffect, useRef, useState } from 'react'
import { Plus, Star, ArrowUpRight } from 'lucide-react'
import { initLibraryMap } from '@/shared/lib/map-adapter/library-map'
import { useLibraryStore } from '@/entities/library-route'
import { DifficultyBadge } from '@/entities/library-route/ui/DifficultyBadge'
import type { LibraryRoute } from '@/entities/library-route'
import type { LibraryMapHandle } from '@/shared/lib/map-adapter/library-map'
import { fetchRouteGpx } from '@/shared/lib/library-api'
import type { GeoPoint } from '@/entities/library-route'

interface Props {
  route: LibraryRoute
  onClose: () => void
}

export function RouteDetailDrawer({ route, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapHandleRef = useRef<LibraryMapHandle | null>(null)
  const isFavorite = useLibraryStore((s) => s.isFavorite(route.id))
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  const [gpxTrack, setGpxTrack] = useState<GeoPoint[] | null>(route.track ?? null)
  const [gpxLoading, setGpxLoading] = useState(!route.track && !!route.gpx)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (route.track) {
      setGpxTrack(route.track)
      setGpxLoading(false)
      return
    }
    if (!route.gpx) {
      setGpxLoading(false)
      return
    }
    setGpxLoading(true)
    fetchRouteGpx(route.region.id, route.gpx)
      .then(setGpxTrack)
      .catch(() => setGpxTrack(null))
      .finally(() => setGpxLoading(false))
  }, [route.id])

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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-x border-zinc-200 rounded-t-[16px] max-w-[560px] mx-auto flex flex-col overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85dvh' }}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-2 shrink-0">
          <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 pt-4 pb-8">

            {/* Heading */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-normal text-zinc-500 leading-5">{route.region.name}</span>
              <h2 className="text-xl font-semibold text-zinc-900 leading-normal">{route.name}</h2>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                className="flex-1 h-9 bg-zinc-900 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 active:bg-zinc-800 transition-colors"
                onClick={() => {
                  // TODO: уточнить у продакт-оунера — см. LIBRARY_UI.md
                }}
              >
                <Plus className="w-4 h-4 shrink-0" />
                Добавить на главную
              </button>
              <button
                onClick={() => toggleFavorite(route.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors shrink-0 active:scale-95 ${
                  isFavorite
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-zinc-200 active:bg-zinc-50'
                }`}
                aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              >
                <Star
                  className="w-4 h-4"
                  style={{ color: isFavorite ? '#f59e0b' : '#3f3f46', fill: isFavorite ? '#f59e0b' : 'none' }}
                />
              </button>
            </div>

            {/* Parameters */}
            <div className="flex flex-col">
              <ParamRow label="Расстояние" value={`${route.distanceKm} км`} />
              <ParamRow label="Сложность" value={<DifficultyBadge difficulty={route.difficulty} />} />
              <ParamRow label="Время" value={route.durationLabel} />
              <ParamRow label="Перепад высот" value={`${route.elevationGainM} м`} />
              {route.nearestSettlement && (
                <div className="flex flex-col py-1.5">
                  <span className="text-sm text-zinc-500 leading-5">Ближайший населенный пункт</span>
                  <span className="text-sm text-zinc-900 leading-5">{route.nearestSettlement}</span>
                </div>
              )}
            </div>

            {/* Map */}
            <div
              ref={mapContainerRef}
              className="w-full rounded-2xl overflow-hidden bg-zinc-100"
              style={{ height: 300 }}
            >
              {gpxLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-zinc-400">Загрузка трека…</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-zinc-900">Описание</h3>
              <p className="text-sm text-zinc-500 leading-5">{route.description}</p>
            </div>

            {/* Attribution */}
            <Attribution source={route.source} />

          </div>
        </div>
      </div>
    </>
  )
}

function ParamRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-zinc-500 leading-5">{label}</span>
      <div className="text-sm text-zinc-900 leading-5">{value}</div>
    </div>
  )
}

function Attribution({ source }: { source: LibraryRoute['source'] }) {
  return (
    <div className="flex items-center gap-4">
      {source.logoUrl && (
        <img src={source.logoUrl} alt={source.name} className="w-[43px] h-[38px] object-contain shrink-0" />
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-sm font-medium text-zinc-900 leading-normal truncate">{source.name}</span>
        <span className="text-xs text-zinc-500 leading-normal">Маршруты предоставлены</span>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 bg-white active:bg-zinc-50 transition-colors shrink-0"
        aria-label="Открыть источник"
      >
        <ArrowUpRight className="w-4 h-4 text-zinc-700" />
      </a>
    </div>
  )
}
