import { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RouteHeader } from '@/widgets/route-header'
import { RouteMap } from '@/widgets/route-map'
import { useRouteStore } from '@/entities/route'
import { useGpsAutoMark } from '@/features/mark-checkpoint'
import { useOffRouteDetect } from '@/features/mark-checkpoint/lib/useOffRouteDetect'
import {
  isAndroidApp,
  onAndroidPosition,
  onAndroidCheckpointAutoMarked,
  onAndroidOffRoute,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '@/shared/lib/android'
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

  // В приложении позицию даёт фоновый сервис: он продолжает работать, когда
  // WebView свёрнут и таймеры в нём засыпают.
  useEffect(() => {
    if (isAndroidApp()) return onAndroidPosition(setUserPos)

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

  const isRouteInProgress = !!route &&
    route.checkpoints.some((cp) => cp.checkedAt !== undefined) &&
    !route.checkpoints.every((cp) => cp.checkedAt !== undefined)

  const isOffRoute = useOffRouteDetect({
    userPos,
    trackPoints: route?.trackPoints ?? [],
    enabled: isRouteInProgress,
  })

  useGpsAutoMark({
    userPos,
    checkpoints: route?.checkpoints ?? [],
    isCircular: route?.isCircular ?? false,
    circularPhase: route?.circularPhase ?? 1,
    markCheckpoint,
  })

  // Фоновое слежение живёт ровно столько, сколько идёт прохождение. Перезапуск
  // на каждое изменение отметок — это и синхронизация: сервис берёт состояние
  // из присланных данных.
  useEffect(() => {
    if (!isAndroidApp() || !route || !isRouteInProgress) return
    startBackgroundTracking(route.checkpoints, route.trackPoints)
    return () => stopBackgroundTracking()
  }, [route?.gpxHash, route?.checkpoints, route?.trackPoints, isRouteInProgress])

  // Точку мог отметить сервис, пока приложение было свёрнуто.
  useEffect(() => onAndroidCheckpointAutoMarked(markCheckpoint), [markCheckpoint])

  // Сход, замеченный в фоне: баннер надо показать, когда человек вернётся в
  // приложение. Снимается он веб-детектором, как только трек снова рядом.
  const [offRouteFromService, setOffRouteFromService] = useState(false)
  useEffect(() => onAndroidOffRoute(() => setOffRouteFromService(true)), [])
  useEffect(() => {
    if (!isOffRoute) setOffRouteFromService(false)
  }, [isOffRoute])

  const handleCelebrationDone = useCallback(() => setShowCelebration(false), [])

  if (!route) return null

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white overflow-hidden">
      <RouteHeader />

      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <RouteMap userPos={userPos ? { lat: userPos.lat, lon: userPos.lon } : null} />
        </div>
        <OffRouteBanner visible={isOffRoute || offRouteFromService} />
        {showCelebration && (
          <FinishCelebration onDone={handleCelebrationDone} />
        )}
      </div>
    </div>
  )
}
