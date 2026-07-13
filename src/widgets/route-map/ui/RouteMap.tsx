import { useEffect, useRef, useState } from 'react'
import { createMapTilerAdapter } from '@/shared/lib/map-adapter'
import type { MapAdapter } from '@/shared/lib/map-adapter'
import { useRouteStore } from '@/entities/route'
import { getLastChecked } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'

interface Props {
  userPos: LatLon | null
}

export function RouteMap({ userPos }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<MapAdapter | null>(null)
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Track current checkpoints for the tap handler closure
  const checkpointsRef = useRef(route?.checkpoints ?? [])
  checkpointsRef.current = route?.checkpoints ?? []

  function handleTap(index: number) {
    const cps = checkpointsRef.current
    const cp = cps[index]
    if (!cp) return
    const lastIdx = getLastChecked(cps)
    if (cp.checkedAt !== undefined && index === lastIdx) {
      unmarkLast()
    } else if (cp.checkedAt === undefined) {
      markCheckpoint(index)
    }
  }

  // Init map once
  useEffect(() => {
    if (!containerRef.current || !route) return

    let cancelled = false
    const adapter = createMapTilerAdapter()
    adapterRef.current = adapter
    const center = route.trackPoints[0]

    adapter.init(containerRef.current, center, 12).then(() => {
      if (cancelled) return
      adapter.fitBounds(route.trackPoints)
      const lastIdx = getLastChecked(route.checkpoints)
      const directionKnown = !route.isCircular || route.circularPhase === 3
      const trackIdx = directionKnown && lastIdx >= 0
        ? route.checkpoints[lastIdx].trackIndex
        : 0
      const numbering = route.isCircular
        ? (route.circularPhase === 1 ? 'none' as const : route.circularPhase === 2 ? 'checked-only' as const : 'all' as const)
        : (lastIdx >= 0 ? 'all' as const : 'none' as const)
      // Virtual Финиш sits on top of Старт on circular routes — never draw it on the map
      const cpsForMap = route.isCircular
        ? route.checkpoints.filter(cp => cp.id !== 'cp_ring_finish')
        : route.checkpoints
      adapter.drawTrack(route.trackPoints, trackIdx)
      adapter.drawCheckpoints(cpsForMap, handleTap, numbering)
      setMapReady(true)
    }).catch((e: unknown) => {
      if (cancelled) return
      const msg = e instanceof Error ? e.message : String(e)
      setMapError(msg)
    })

    return () => {
      cancelled = true
      adapter.destroy()
      adapterRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw when checkpoints change
  useEffect(() => {
    if (!adapterRef.current || !route) return
    const lastIdx = getLastChecked(route.checkpoints)
    const directionKnown = !route.isCircular || route.circularPhase === 3
    const trackIdx = directionKnown && lastIdx >= 0
      ? route.checkpoints[lastIdx].trackIndex
      : 0
    const numbering = route.isCircular && route.circularPhase === 1 ? 'none' as const
        : route.isCircular && route.circularPhase === 2 ? 'checked-only' as const
        : 'all' as const
    // In phase 2 the virtual Финиш sits on top of Старт — don't draw it
    const cpsForMap = route.isCircular && route.circularPhase === 2
      ? route.checkpoints.filter(cp => cp.id !== 'cp_ring_finish')
      : route.checkpoints
    adapterRef.current.drawTrack(route.trackPoints, trackIdx)
    adapterRef.current.drawCheckpoints(cpsForMap, handleTap, numbering)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.checkpoints])

  // Update user position on map
  useEffect(() => {
    adapterRef.current?.updateUserPosition(userPos)
  }, [userPos])

return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5]">
          <p className="text-sm text-[#737373]">Загрузка карты…</p>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f5f5f5] gap-1 px-6 text-center">
          <p className="text-sm font-medium text-[#0a0a0a]">Карта недоступна</p>
          <p className="text-xs text-[#737373]">{mapError}</p>
          <p className="text-xs text-[#737373] mt-1">Проверьте ключ API в .env</p>
        </div>
      )}
    </div>
  )
}
