import { useEffect, useRef } from 'react'
import { haversineKm } from '@/shared/lib/geo'
import { getLastChecked } from '@/entities/checkpoint'
import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'

const RADIUS_KM = 0.030       // 30 metres
const ACCURACY_MAX_M = 50     // ignore positions worse than 50m accuracy
const DWELL_MS = 3000         // must stay within radius for 3 seconds

interface GpsPosition extends LatLon {
  accuracy: number
}

interface Params {
  userPos: GpsPosition | null
  checkpoints: Checkpoint[]
  isCircular: boolean
  circularPhase: number
  markCheckpoint: (index: number) => void
}

export function useGpsAutoMark({
  userPos,
  checkpoints,
  isCircular,
  circularPhase,
  markCheckpoint,
}: Params) {
  const candidateIdxRef = useRef<number | null>(null)
  const candidateSinceRef = useRef<number>(0)

  useEffect(() => {
    // Require manual first mark before GPS auto-marking kicks in
    const lastIdx = getLastChecked(checkpoints)
    if (isCircular && circularPhase < 3) return
    if (!isCircular && lastIdx < 0) return

    // No GPS or accuracy too poor
    if (!userPos || userPos.accuracy > ACCURACY_MAX_M) {
      candidateIdxRef.current = null
      return
    }

    // Next checkpoint to auto-mark
    const nextIdx = lastIdx + 1
    if (nextIdx >= checkpoints.length) return
    const next = checkpoints[nextIdx]
    if (!next || next.checkedAt !== undefined) return

    const dist = haversineKm(userPos, next)

    if (dist > RADIUS_KM) {
      candidateIdxRef.current = null
      return
    }

    const now = Date.now()

    if (candidateIdxRef.current !== nextIdx) {
      // Just entered radius for this checkpoint — start dwell timer
      candidateIdxRef.current = nextIdx
      candidateSinceRef.current = now
      return
    }

    // Already dwelling — check if 3 seconds have passed
    if (now - candidateSinceRef.current >= DWELL_MS) {
      markCheckpoint(nextIdx)
      candidateIdxRef.current = null
    }
  }, [userPos, checkpoints, isCircular, circularPhase, markCheckpoint])
}
