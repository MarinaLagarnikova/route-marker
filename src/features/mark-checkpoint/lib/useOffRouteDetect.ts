import { useEffect, useState } from 'react'
import { haversineKm } from '@/shared/lib/geo'
import type { LatLon } from '@/shared/lib/geo'

const OFF_ROUTE_KM = 0.100       // 100 metres
const DWELL_MS = 20_000          // 20 seconds stable before alert
const ACCURACY_MAX_M = 50
const SPEED_MAX_MS = 4.2         // ~15 km/h — ignore if in transport

interface GpsPosition extends LatLon {
  accuracy: number
  speed: number | null
}

interface Params {
  userPos: GpsPosition | null
  trackPoints: LatLon[]
}

export function useOffRouteDetect({ userPos, trackPoints }: Params): boolean {
  const [isOffRoute, setIsOffRoute] = useState(false)

  useEffect(() => {
    // No GPS, poor accuracy, or transport speed → clear state
    if (
      !userPos ||
      userPos.accuracy > ACCURACY_MAX_M ||
      (userPos.speed !== null && userPos.speed > SPEED_MAX_MS)
    ) {
      setIsOffRoute(false)
      return
    }

    if (trackPoints.length === 0) return

    const minDist = trackPoints.reduce(
      (min, tp) => Math.min(min, haversineKm(userPos, tp)),
      Infinity
    )

    if (minDist > OFF_ROUTE_KM) {
      const timer = setTimeout(() => setIsOffRoute(true), DWELL_MS)
      return () => clearTimeout(timer)
    } else {
      setIsOffRoute(false)
    }
  }, [userPos, trackPoints])

  return isOffRoute
}
