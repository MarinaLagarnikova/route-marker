import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { initCollectionMap } from '@/shared/lib/map-adapter/library-map'
import { RouteDetailDrawer } from '@/widgets/route-detail-drawer'
import type { LibraryRoute } from '@/entities/library-route'
import type { LibraryMapHandle } from '@/shared/lib/map-adapter/library-map'

interface Props {
  routes: LibraryRoute[]
  onClose: () => void
}

export function CollectionMap({ routes, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapHandleRef = useRef<LibraryMapHandle | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<LibraryRoute | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  useEffect(() => {
    if (!mapContainerRef.current) return
    let handle: LibraryMapHandle | null = null
    const cancel = { cancelled: false }

    initCollectionMap(
      mapContainerRef.current,
      routes.map((r) => ({ id: r.id, track: r.trackSimplified, name: r.name })),
      (routeId) => {
        const found = routes.find((r) => r.id === routeId)
        if (found) setSelectedRoute(found)
      },
      true,
      cancel
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

  return (
    <div className={`fixed inset-0 z-30 flex flex-col max-w-[560px] mx-auto transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      {/* Full-screen map */}
      <div ref={mapContainerRef} className="flex-1 bg-zinc-100" />

      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
          <p className="text-sm text-zinc-400">Загрузка карты…</p>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors z-10"
        aria-label="Закрыть карту"
      >
        <X className="w-4 h-4 text-zinc-900" />
      </button>

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
