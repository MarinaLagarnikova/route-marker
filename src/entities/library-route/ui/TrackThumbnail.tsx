import { useMemo } from 'react'
import type { GeoPoint } from '../model'

interface Props {
  track: GeoPoint[]
  /** Outer wrapper size in px (default: 48) */
  size?: number
  /** SVG track canvas size in px (default: 30) */
  trackSize?: number
  className?: string
}

function bbox(track: GeoPoint[]) {
  const lats = track.map((p) => p.lat)
  const lons = track.map((p) => p.lon)
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  }
}

/**
 * Build a uniform-scale projection that preserves the track's real-world shape.
 * Corrects for cos(lat) longitude distortion and centers the result in the canvas.
 */
function buildProjection(track: GeoPoint[], canvasSize: number) {
  const b = bbox(track)
  const pad = 0.12
  const midLat = (b.north + b.south) / 2
  const cosLat = Math.cos((midLat * Math.PI) / 180)

  // metric-proportional extents
  const dLat = (b.north - b.south) * (1 + 2 * pad)
  const dLon = (b.east - b.west) * cosLat * (1 + 2 * pad)

  const scale = canvasSize / Math.max(dLat, dLon)
  const renderW = dLon * scale
  const renderH = dLat * scale
  const ox = (canvasSize - renderW) / 2
  const oy = (canvasSize - renderH) / 2

  const west  = b.west  - (b.east  - b.west)  * pad
  const north = b.north + (b.north - b.south) * pad

  return (p: GeoPoint) => ({
    x: ox + (p.lon - west) * cosLat * scale,
    y: oy + (north - p.lat) * scale,
  })
}

/**
 * Card thumbnail: static map background + SVG track overlay.
 * Shape naturally communicates loop vs linear route.
 */
export function TrackThumbnail({ track, size = 48, trackSize = 30, className = '' }: Props) {
  const svgPath = useMemo(() => {
    if (track.length < 2) return ''
    const project = buildProjection(track, trackSize)
    const pts = track.map(project)
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }, [track, trackSize])

  const offset = (size - trackSize) / 2

  return (
    <div
      className={`relative overflow-hidden rounded-xl shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Static map background */}
      <img
        src="/map-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* SVG track overlay, centered */}
      <svg
        className="absolute"
        style={{ left: offset, top: offset }}
        width={trackSize}
        height={trackSize}
        viewBox={`0 0 ${trackSize} ${trackSize}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={svgPath}
          stroke="#FF7A29"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
