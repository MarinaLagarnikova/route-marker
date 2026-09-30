import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, X } from 'lucide-react'
import { initLibraryMap } from '@/shared/lib/map-adapter/library-map'
import { useSheetDrag } from '@/shared/lib/sheet-drag'
import { StartRouteButton } from '@/features/start-library-route'
import { useLibraryStore } from '@/entities/library-route'
import { DifficultyBadge } from '@/entities/library-route/ui/DifficultyBadge'
import { PhotoStories } from '@/entities/library-route/ui/PhotoStories'
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const drag = useSheetDrag(handleClose)

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
        className={`fixed inset-0 bg-black/30 z-40 ${drag.dragging ? '' : 'transition-opacity duration-300'} ${visible ? 'opacity-100' : 'opacity-0'}`}
        // Фон светлеет по мере вытягивания — видно, что шторка вот-вот закроется.
        style={drag.offset ? { opacity: Math.max(0, 1 - drag.offset / 400) } : undefined}
        onClick={handleClose}
      />

      {/* Close button + Sheet — wrapped together so button stays 6px above sheet.
          The wrapper spans the full screen so the sheet always reaches its
          maximum height instead of hugging the content. */}
      <div
        className={`fixed inset-0 z-50 max-w-[560px] mx-auto flex flex-col ease-out pointer-events-none ${drag.dragging ? '' : 'transition-transform duration-300'} ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={drag.offset ? { transform: `translateY(${drag.offset}px)` } : undefined}
      >
        {/* Close button row */}
        <div className="flex justify-end px-4 pt-3 pb-1.5 shrink-0 pointer-events-none">
          <button
            onClick={handleClose}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sheet */}
        <div
          ref={drag.sheetRef}
          className="bg-white border-t border-x border-zinc-200 rounded-t-[16px] flex flex-col overflow-hidden min-h-0 flex-1 pointer-events-auto"
        >
        {/* Handle */}
        <div className="flex items-center justify-center pt-2 shrink-0">
          <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div ref={drag.scrollRef} className="overflow-y-auto overscroll-contain min-h-0 flex-1">
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
              <StartRouteButton route={route} />
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
                {/* Negative margin lets the strip bleed to the sheet edges while keeping content padding.
                    scroll-pl-4 is what keeps the first photo aligned with the text: snap points
                    ignore padding, so without it the browser scrolls the padding away. */}
                <div className="flex items-start gap-2 overflow-x-auto overscroll-x-contain -mx-4 px-4 scroll-pl-4 pb-1 snap-x snap-mandatory">
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
                        // Two lines are reserved so cards keep a common height.
                        <p className="text-xs text-zinc-500 leading-4 mt-1.5 line-clamp-2 min-h-8">
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
