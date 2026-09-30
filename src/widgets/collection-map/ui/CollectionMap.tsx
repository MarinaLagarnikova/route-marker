import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { initCollectionMap } from '@/shared/lib/map-adapter/library-map'
import { RouteDetailDrawer } from '@/widgets/route-detail-drawer'
import { PhotoStories } from '@/entities/library-route'
import type { LibraryRoute, RoutePhoto } from '@/entities/library-route'
import { readOverlayVisible, writeOverlayVisible, type RoutePoi } from '@/shared/lib/poi'
import { PoiSheet } from '@/shared/ui/PoiSheet'
import type { LibraryMapHandle } from '@/shared/lib/map-adapter/library-map'

interface Props {
  routes: LibraryRoute[]
  onBack: () => void
}

function placedPhotos(route: LibraryRoute | null): RoutePhoto[] {
  return (route?.photos ?? []).filter((p) => p.lat !== undefined && p.lon !== undefined)
}

export function CollectionMap({ routes, onBack }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapHandleRef = useRef<LibraryMapHandle | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<LibraryRoute | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedPoi, setSelectedPoi] = useState<RoutePoi | null>(null)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)

  // Слой переживает закрытие шторки: иначе объекты видно только из-под неё,
  // а смотрят их как раз на открытой карте.
  const [overlayRoute, setOverlayRoute] = useState<LibraryRoute | null>(null)
  const overlayPhotos = placedPhotos(overlayRoute)

  useEffect(() => {
    if (!mapContainerRef.current) return
    let handle: LibraryMapHandle | null = null
    const cancel = { cancelled: false }

    initCollectionMap(
      mapContainerRef.current,
      routes.map((r) => ({ id: r.id, track: r.trackSimplified, name: r.name })),
      (routeId) => {
        const found = routes.find((r) => r.id === routeId)
        if (found) {
          setSelectedRoute(found)
          setOverlayRoute(found)
        }
      },
      true,
      cancel,
      { onPoiTap: setSelectedPoi, onPhotoTap: setPhotoIndex },
    ).then((h) => {
      if (cancel.cancelled) { h.destroy(); return }
      handle = h
      mapHandleRef.current = h
      setMapLoaded(true)
    })

    return () => {
      cancel.cancelled = true
      handle?.destroy()
      mapHandleRef.current = null
    }
  }, [routes])

  // Объекты показываем только у выбранного маршрута: в подборке их до тридцати,
  // и все сразу — это сотни значков.
  useEffect(() => {
    if (!mapLoaded) return
    setSelectedPoi(null)
    setPhotoIndex(null)
    const pois = overlayRoute?.pois ?? []
    const photos = placedPhotos(overlayRoute)
    void mapHandleRef.current?.showOverlay?.(
      pois,
      photos.map((p) => ({ src: p.src, lat: p.lat!, lon: p.lon! })),
    )
    // Кнопка, которая ничего не делает, хуже отсутствующей: тогл появляется
    // только когда у выбранного маршрута есть что показать.
    if (pois.length > 0 || photos.length > 0) {
      mapHandleRef.current?.addOverlayToggle?.(readOverlayVisible(), (visible) => {
        writeOverlayVisible(visible)
        if (!visible) {
          setSelectedPoi(null)
          setPhotoIndex(null)
        }
      })
    }
  }, [overlayRoute, mapLoaded])

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto relative">
      {/* Full-screen map */}
      <div ref={mapContainerRef} className="flex-1 bg-zinc-100" />

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
          <p className="text-sm text-zinc-400">Загрузка карты…</p>
        </div>
      )}

      {/* Back button — same control as on the collection list, so the two
          screens read as one linear stack. */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors z-10"
        aria-label="Назад к списку"
      >
        <ChevronLeft className="w-4 h-4 text-zinc-900" />
      </button>

      {!selectedRoute && selectedPoi && (
        <PoiSheet poi={selectedPoi} onClose={() => setSelectedPoi(null)} />
      )}

      {photoIndex !== null && overlayPhotos.length > 0 && (
        <PhotoStories
          photos={overlayPhotos}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
          onClose={() => setPhotoIndex(null)}
        />
      )}

      {/* Route detail drawer — appears over the map */}
      {selectedRoute && (
        <RouteDetailDrawer
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  )
}
