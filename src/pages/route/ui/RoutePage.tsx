import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteHeader } from '@/widgets/route-header'
import { RouteMap } from '@/widgets/route-map'
import { useRouteStore } from '@/entities/route'
import { useGpsAutoMark } from '@/features/mark-checkpoint'
import { useOffRouteDetect } from '@/features/mark-checkpoint/lib/useOffRouteDetect'
import { FinishCelebration } from './FinishCelebration'
import { OffRouteBanner } from './OffRouteBanner'
import type { LatLon } from '@/shared/lib/geo'


export function RoutePage() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)
  const [showCelebration, setShowCelebration] = useState(false)
  const celebratedRef = useRef(false)
  const [userPos, setUserPos] = useState<(LatLon & { accuracy: number; speed: number | null }) | null>(null)

  useEffect(() => {
    if (!route) navigate('/', { replace: true })
  }, [route, navigate])

  useEffect(() => {
    if (!route) return
    const allChecked =
      route.checkpoints.length > 0 &&
      route.checkpoints.every((cp) => cp.checkedAt !== undefined)
    if (allChecked && !celebratedRef.current) {
      celebratedRef.current = true
      setShowCelebration(true)
    }
  }, [route?.checkpoints])

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserPos({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
      }),
      () => setUserPos(null),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)

  const isOffRoute = useOffRouteDetect({
    userPos,
    trackPoints: route?.trackPoints ?? [],
  })

  useGpsAutoMark({
    userPos,
    checkpoints: route?.checkpoints ?? [],
    isCircular: route?.isCircular ?? false,
    circularPhase: route?.circularPhase ?? 1,
    markCheckpoint,
  })

  if (!route) return null

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white overflow-hidden">
      <RouteHeader />

      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <RouteMap userPos={userPos ? { lat: userPos.lat, lon: userPos.lon } : null} />
        </div>
        <OffRouteBanner visible={isOffRoute} />
        {showCelebration && (
          <FinishCelebration onDone={() => setShowCelebration(false)} />
        )}
      </div>
    </div>
  )
}
