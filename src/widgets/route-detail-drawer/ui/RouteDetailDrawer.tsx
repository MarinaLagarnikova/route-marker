import { useEffect, useRef, useState } from 'react'
import { Check, Plus, Star, ArrowUpRight } from 'lucide-react'
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
  const isPinned = useLibraryStore((s) => s.isPinned(route.id))
  const pinRoute = useLibraryStore((s) => s.pinRoute)
  const unpinRoute = useLibraryStore((s) => s.unpinRoute)
  const [addState, setAddState] = useState<'idle' | 'loading' | 'done'>(isPinned ? 'done' : 'idle')
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
                disabled={addState === 'loading'}
                className={`flex-1 h-9 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 transition-colors ${addState === 'loading' ? 'bg-zinc-500' : 'bg-zinc-900 active:bg-zinc-800'}`}
                onClick={() => {
                  if (addState === 'loading') return
                  if (addState === 'done') {
                    unpinRoute(route.id)
                    setAddState('idle')
                    return
                  }
                  setAddState('loading')
                  setTimeout(() => {
                    pinRoute(route)
                    setAddState('done')
                  }, 600)
                }}
              >
                {addState === 'loading' && (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="animate-spin shrink-0">
                      <path d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8Z" fill="white" fillOpacity="0.3"/>
                      <path d="M8.00391 16C5.88217 16 3.84734 15.1571 2.34705 13.6569C0.846761 12.1566 0.00390641 10.1217 0.00390625 8C0.00390609 5.87827 0.846761 3.84344 2.34705 2.34315C3.84734 0.842855 5.88217 3.20373e-07 8.00391 0L8.00391 2C6.41261 2 4.88648 2.63214 3.76127 3.75736C2.63605 4.88258 2.00391 6.4087 2.00391 8C2.00391 9.5913 2.63605 11.1174 3.76127 12.2426C4.88648 13.3679 6.41261 14 8.00391 14V16Z" fill="white"/>
                    </svg>
                    Добавляем на главную…
                  </>
                )}
                {addState === 'done' && (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    На главной
                  </>
                )}
                {addState === 'idle' && (
                  <>
                    <Plus className="w-4 h-4 shrink-0" />
                    Добавить на главную
                  </>
                )}
              </button>
              <button
                onClick={() => toggleFavorite(route.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0 active:scale-95 ${
                  isFavorite
                    ? 'bg-[#FF7A29] active:bg-[#e86d22]'
                    : 'bg-white border border-zinc-200 active:bg-zinc-50'
                }`}
                aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              >
                <Star
                  className="w-4 h-4"
                  style={{ color: isFavorite ? 'white' : '#3f3f46', fill: isFavorite ? 'white' : 'none' }}
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
        <span className="text-sm font-medium text-zinc-900 leading-normal truncate">Маркированные маршруты России</span>
        <span className="text-xs text-zinc-500 leading-normal">Подробнее о маршруте</span>
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
