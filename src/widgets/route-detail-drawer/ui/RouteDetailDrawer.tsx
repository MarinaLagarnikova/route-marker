import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, Plus, X } from 'lucide-react'
import { initLibraryMap } from '@/shared/lib/map-adapter/library-map'
import { useLibraryStore } from '@/entities/library-route'
import { DifficultyBadge } from '@/entities/library-route/ui/DifficultyBadge'
import type { LibraryRoute, RoutePhoto } from '@/entities/library-route'
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

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
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Close button + Sheet — wrapped together so button stays 6px above sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-[560px] mx-auto flex flex-col transition-transform duration-300 ease-out pointer-events-none ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '90dvh' }}
      >
        {/* Close button row */}
        <div className="flex justify-end px-4 pb-1.5 pointer-events-none">
          <button
            onClick={handleClose}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sheet */}
        <div className="bg-white border-t border-x border-zinc-200 rounded-t-[16px] flex flex-col overflow-hidden min-h-0 flex-1 pointer-events-auto">
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

            {/* Parameters */}
            <div className="flex flex-col">
              <ParamRow label="Расстояние" value={`${route.distanceKm} км`} />
              <ParamRow label="Сложность" value={<DifficultyBadge difficulty={route.difficulty} textColor="text-zinc-900" />} />
              <ParamRow label="Время" value={route.durationLabel} />
              <ParamRow label="Перепад высот" value={`${route.elevationGainM} м`} />
              {route.nearestSettlement && (
                <div className="flex flex-col py-1.5">
                  <span className="text-sm text-zinc-500 leading-5">Ближайший населенный пункт</span>
                  <span className="text-sm text-zinc-900 leading-5">{route.nearestSettlement}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
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
                onClick={() => toggleFavorite(route.id, route.region.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0 active:scale-95 ${
                  isFavorite
                    ? 'bg-[#FFF3EC] border border-[#FF7A29] active:bg-[#ffe8d6]'
                    : 'bg-white border border-zinc-200 active:bg-zinc-50'
                }`}
                aria-label={isFavorite ? 'Убрать из списка' : 'Хочу пройти'}
              >
                <Bookmark
                  className="w-4 h-4"
                  style={{ color: isFavorite ? '#FF7A29' : '#3f3f46', fill: isFavorite ? '#FF7A29' : 'none' }}
                />
              </button>
            </div>

            {/* Favorite hint */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${isFavorite ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <p className="text-xs text-zinc-500 leading-[1.4] pt-0.5 text-center">
                Добавлен в подборку «Хочу пройти»
              </p>
            </div>
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
              {/* Descriptions may be several paragraphs, separated by a blank line. */}
              {route.description.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i} className="text-sm text-zinc-500 leading-5">
                  {paragraph.trim()}
                </p>
              ))}
            </div>

            {/* Photos */}
            {route.photos && route.photos.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-zinc-900">Фото</h3>
                {/* Negative margin lets the strip bleed to the sheet edges while keeping content padding. */}
                <div className="flex gap-2 overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-1 snap-x snap-mandatory">
                  {route.photos.map((photo, i) => (
                    <button
                      key={photo.src}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="w-[68%] shrink-0 snap-start text-left active:opacity-80 transition-opacity"
                      aria-label={photo.caption ?? `Фото ${i + 1} из ${route.photos!.length}`}
                    >
                      <img
                        src={photo.src}
                        alt=""
                        loading="lazy"
                        className="w-full aspect-[3/4] object-cover rounded-xl bg-zinc-100"
                      />
                      {photo.caption && (
                        <p className="text-xs text-zinc-500 leading-4 mt-1.5 line-clamp-2">
                          {photo.caption}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attribution */}
            <div className="h-px bg-zinc-100" />
            <Attribution source={route.source} />

          </div>
        </div>
        </div>{/* Sheet */}
      </div>{/* Wrapper */}

      {lightboxIndex !== null && route.photos && (
        <PhotoStories
          photos={route.photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}

const SWIPE_THRESHOLD_PX = 50

/** Stories-style viewer: segment bar on top, tap the edges or swipe to move between shots. */
function PhotoStories({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: RoutePhoto[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const touchStartX = useRef<number | null>(null)
  const photo = photos[index]

  function go(delta: number) {
    const next = index + delta
    // Past the last shot the story ends, as it would in a stories player.
    if (next < 0) return
    if (next >= photos.length) return onClose()
    onIndexChange(next)
  }

  // Opened from a drawer that already scrolls; lock the page behind it.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографий"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null) return
        const delta = e.changedTouches[0].clientX - start
        if (Math.abs(delta) > SWIPE_THRESHOLD_PX) go(delta < 0 ? 1 : -1)
      }}
    >
      {/* Segments */}
      <div className="flex gap-1 px-3 pt-3 shrink-0">
        {photos.map((p, i) => (
          <div
            key={p.src}
            className={`h-0.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <span className="text-xs text-white/60">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <img src={photo.src} alt={photo.caption ?? ''} className="max-w-full max-h-full object-contain" />

        {/* Tap zones sit above the image; the left one is narrower, as in stories players. */}
        <button
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => go(-1)}
          aria-label="Предыдущее фото"
        />
        <button
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => go(1)}
          aria-label="Следующее фото"
        />
      </div>

      {(photo.caption || photo.km !== undefined) && (
        <div className="px-4 pt-3 pb-6 shrink-0">
          {photo.caption && <p className="text-sm text-white leading-5">{photo.caption}</p>}
          {photo.km !== undefined && (
            <p className="text-xs text-white/50 leading-5 mt-0.5">
              {photo.km.toFixed(1)} км маршрута
            </p>
          )}
        </div>
      )}
    </div>
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
  const subtitle = source.note ?? (source.url ? 'Подробнее о маршруте' : undefined)

  const content = (
    <>
      {source.logoUrl && (
        <img src={source.logoUrl} alt={source.name} className="w-[43px] h-[38px] object-contain shrink-0" />
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-sm font-medium text-zinc-900 leading-normal truncate">
          {source.tagline ?? source.name}
        </span>
        {subtitle && <span className="text-xs text-zinc-500 leading-normal">{subtitle}</span>}
      </div>
      {source.url && (
        <div className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 bg-white shrink-0">
          <ArrowUpRight className="w-4 h-4 text-zinc-700" />
        </div>
      )}
    </>
  )

  // Our own routes have nowhere to link to — the drawer already holds everything.
  if (!source.url) return <div className="flex items-center gap-4">{content}</div>

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 active:opacity-70 transition-opacity"
    >
      {content}
    </a>
  )
}
