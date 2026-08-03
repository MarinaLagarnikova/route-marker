import { useMemo } from 'react'
import type { GeoPoint } from '../model'

interface Props {
  track: GeoPoint[]
  width?: number
  height?: number
  className?: string
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon
  return R * 2 * Math.asin(Math.sqrt(h))
}

/**
 * Thin monochrome elevation profile line for route cards.
 * Returns null if no elevation data in track.
 */
export function ElevationProfile({ track, width = 56, height = 24, className = '' }: Props) {
  const path = useMemo(() => {
    const withEle = track.filter((p) => p.ele !== undefined)
    if (withEle.length < 2) return null

    // Compute cumulative distances for X axis
    let dist = 0
    const distances: number[] = [0]
    for (let i = 1; i < withEle.length; i++) {
      dist += haversineKm(withEle[i - 1], withEle[i])
      distances.push(dist)
    }
    const totalDist = distances[distances.length - 1]

    const elevations = withEle.map((p) => p.ele!)
    const minEle = Math.min(...elevations)
    const maxEle = Math.max(...elevations)
    const eleRange = maxEle - minEle || 1

    const padding = 2
    const w = width - padding * 2
    const h = height - padding * 2

    const points = withEle.map((p, i) => {
      const x = padding + (distances[i] / totalDist) * w
      const y = padding + (1 - (p.ele! - minEle) / eleRange) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    return `M${points.join(' L')}`
  }, [track, width, height])

  if (!path) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d={path} stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
