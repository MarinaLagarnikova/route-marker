import type { GeoPoint } from '@/entities/library-route'

interface Props {
  points: GeoPoint[]
  className?: string
}

export function ElevationSparkline({ points, className }: Props) {
  const withEle = points.filter((p) => p.ele !== undefined)
  if (withEle.length < 2) return null

  const eles = withEle.map((p) => p.ele as number)
  const min = Math.min(...eles)
  const max = Math.max(...eles)
  const range = max - min || 1

  const W = 100
  const H = 32
  const PAD = 2

  const coords = withEle.map((p, i) => {
    const x = PAD + (i / (withEle.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((((p.ele as number) - min) / range) * (H - PAD * 2))
    return [x, y] as [number, number]
  })

  // Smooth path via Catmull-Rom → cubic bezier conversion
  // For each segment P1→P2, control points: CP1 = P1 + (P2-P0)/6, CP2 = P2 - (P3-P1)/6
  function catmullRomToBezier(pts: [number, number][]): string {
    if (pts.length < 2) return ''
    let path = `M ${pts[0][0]} ${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`
    }
    return path
  }

  const d = catmullRomToBezier(coords)

  // Fill path closes back along bottom
  const fillD = `${d} L ${coords[coords.length - 1][0]} ${H} L ${coords[0][0]} ${H} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <path d={fillD} fill="rgba(161,161,170,0.15)" stroke="none" />
      <path d={d} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
