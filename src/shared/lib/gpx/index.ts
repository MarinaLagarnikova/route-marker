import type { LatLon } from '@/shared/lib/geo'
import { haversineKm, cumulativeDistances } from '@/shared/lib/geo'

const MIN_STAGE_KM = 1.0

export const MULTI_STAGE_GAP_KM = 1.0

export interface GpxWaypoint extends LatLon {
  name: string
}

export interface StageGpxData {
  name: string
  trackPoints: LatLon[]
  trackSegments: LatLon[][]
  waypoints: GpxWaypoint[]
}

export interface GpxData {
  name: string
  trackPoints: LatLon[]
  trackSegments: LatLon[][]
  waypoints: GpxWaypoint[]
  isMultiStage: boolean
  stages?: StageGpxData[]
}

export function parseGpx(xml: string): GpxData {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Файл повреждён: не удалось разобрать XML')

  // Try trkseg first, then rtept as one segment
  const trksegs = Array.from(doc.querySelectorAll('trkseg'))
  const rtepts = Array.from(doc.querySelectorAll('rtept'))

  let rawSegments: LatLon[][] = []

  if (trksegs.length > 0) {
    rawSegments = trksegs
      .map((seg) =>
        Array.from(seg.querySelectorAll('trkpt')).map((el) => ({
          lat: parseFloat(el.getAttribute('lat') ?? '0'),
          lon: parseFloat(el.getAttribute('lon') ?? '0'),
        }))
      )
      .filter((s) => s.length >= 2)
  } else if (rtepts.length >= 2) {
    rawSegments = [
      rtepts.map((el) => ({
        lat: parseFloat(el.getAttribute('lat') ?? '0'),
        lon: parseFloat(el.getAttribute('lon') ?? '0'),
      })),
    ]
  }

  if (rawSegments.length === 0) {
    throw new Error('GPX-файл не содержит трека (нужно минимум 2 точки trkpt/rtept)')
  }

  const waypoints: GpxWaypoint[] = Array.from(doc.querySelectorAll('wpt')).map((el) => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    name: el.querySelector('name')?.textContent?.trim() ?? 'Точка',
  }))

  const metaName = doc.querySelector('metadata > name')?.textContent?.trim()
  const trkName = doc.querySelector('trk > name')?.textContent?.trim()
  const name = metaName ?? trkName ?? ''

  // Detect multi-stage BEFORE sorting segments
  if (rawSegments.length >= 2) {
    const stageGroups = groupSegmentsByGap(rawSegments, MULTI_STAGE_GAP_KM)
    if (stageGroups.length >= 2) {
      // Multi-stage route — filter out stages shorter than MIN_STAGE_KM
      const allStages: StageGpxData[] = stageGroups.map((group) => {
        const sortedSegs = group.length > 1 ? sortSegments(group) : group
        const stagePoints: LatLon[] = ([] as LatLon[]).concat(...sortedSegs)
        return {
          name: '',
          trackPoints: stagePoints,
          trackSegments: sortedSegs,
          waypoints,
        }
      }).filter((s) => {
        const dists = cumulativeDistances(s.trackPoints)
        return dists[dists.length - 1] >= MIN_STAGE_KM
      })

      const stages: StageGpxData[] = allStages.map((s, i) => ({ ...s, name: `Этап ${i + 1}` }))

      const allSegments = stages.flatMap((s) => s.trackSegments)
      const allPoints: LatLon[] = ([] as LatLon[]).concat(...allSegments)

      if (allPoints.length < 2) {
        throw new Error('GPX-файл не содержит трека (нужно минимум 2 точки trkpt/rtept)')
      }

      return {
        name,
        trackPoints: allPoints,
        trackSegments: allSegments,
        waypoints,
        isMultiStage: true,
        stages,
      }
    }
  }

  const trackSegments = rawSegments.length > 1 ? sortSegments(rawSegments) : rawSegments
  const trackPoints: LatLon[] = ([] as LatLon[]).concat(...trackSegments)

  if (trackPoints.length < 2) {
    throw new Error('GPX-файл не содержит трека (нужно минимум 2 точки trkpt/rtept)')
  }

  return { name, trackPoints, trackSegments, waypoints, isMultiStage: false }
}

/** Group segments into stages: if gap between end of previous and start of next < gapKm — same stage, else new stage. */
function groupSegmentsByGap(segs: LatLon[][], gapKm: number): LatLon[][][] {
  if (segs.length === 0) return []
  const groups: LatLon[][][] = [[segs[0]]]
  for (let i = 1; i < segs.length; i++) {
    const prevGroup = groups[groups.length - 1]
    const prevSeg = prevGroup[prevGroup.length - 1]
    const prevEnd = prevSeg[prevSeg.length - 1]
    const nextStart = segs[i][0]
    const gap = haversineKm(prevEnd, nextStart)
    if (gap < gapKm) {
      prevGroup.push(segs[i])
    } else {
      groups.push([segs[i]])
    }
  }
  return groups
}

/** Sort disconnected segments into a continuous path.
 *  Runs greedy nearest-neighbour from every possible starting segment
 *  and returns the result with the smallest total inter-segment gap. */
function sortSegments(segs: LatLon[][]): LatLon[][] {
  if (segs.length <= 1) return segs

  let bestResult: LatLon[][] = []
  let bestTotalGap = Infinity

  for (let startIdx = 0; startIdx < segs.length; startIdx++) {
    const remaining = segs.slice()
    const first = remaining.splice(startIdx, 1)[0]
    const result: LatLon[][] = [first]
    let totalGap = 0

    while (remaining.length > 0) {
      const current = result[result.length - 1]
      const tail = current[current.length - 1]

      let bestIdx = 0
      let bestDist = Infinity
      let bestFlip = false

      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i]
        const dStart = haversineKm(tail, s[0])
        const dEnd = haversineKm(tail, s[s.length - 1])
        if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestFlip = false }
        if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestFlip = true }
      }

      totalGap += bestDist
      const next = remaining.splice(bestIdx, 1)[0]
      result.push(bestFlip ? next.slice().reverse() : next)
    }

    if (totalGap < bestTotalGap) {
      bestTotalGap = totalGap
      bestResult = result
    }
  }

  return bestResult
}
