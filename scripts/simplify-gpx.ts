#!/usr/bin/env tsx
/**
 * Simplifies a GPX track using the Ramer-Douglas-Peucker algorithm.
 * Usage: npx tsx scripts/simplify-gpx.ts ./path/to/file.gpx [epsilon]
 * epsilon — simplification threshold in degrees (default: 0.001 ≈ ~100m)
 * Outputs JSON array of { lat, lon } points to stdout (for trackSimplified)
 * Stats printed to stderr
 */

import { readFileSync } from 'fs'

interface Point { lat: number; lon: number; ele?: number }

function parseGpxPoints(xml: string): Point[] {
  // Extract each trkpt block and parse lat/lon/ele from it
  const trkptRegex = /<trkpt\s([^>]*)>([\s\S]*?)<\/trkpt>/g
  const coords: Point[] = []
  let m: RegExpExecArray | null
  while ((m = trkptRegex.exec(xml)) !== null) {
    const attrs = m[1]
    const inner = m[2]
    const latM = attrs.match(/lat="([^"]+)"/)
    const lonM = attrs.match(/lon="([^"]+)"/)
    if (!latM || !lonM) continue
    const lat = parseFloat(latM[1])
    const lon = parseFloat(lonM[1])
    const eleM = inner.match(/<ele>([^<]+)<\/ele>/)
    const ele = eleM ? parseFloat(eleM[1]) : undefined
    coords.push(ele !== undefined ? { lat, lon, ele } : { lat, lon })
  }
  return coords
}

function perpendicularDistance(p: Point, start: Point, end: Point): number {
  const dx = end.lon - start.lon
  const dy = end.lat - start.lat
  if (dx === 0 && dy === 0) {
    return Math.hypot(p.lon - start.lon, p.lat - start.lat)
  }
  const t = ((p.lon - start.lon) * dx + (p.lat - start.lat) * dy) / (dx * dx + dy * dy)
  const nearLon = start.lon + t * dx
  const nearLat = start.lat + t * dy
  return Math.hypot(p.lon - nearLon, p.lat - nearLat)
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points
  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon)
    const right = rdp(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[points.length - 1]]
}

const filePath = process.argv[2]
const epsilon = parseFloat(process.argv[3] ?? '0.001')

if (!filePath) {
  console.error('Usage: npx tsx scripts/simplify-gpx.ts <file.gpx> [epsilon]')
  process.exit(1)
}

const xml = readFileSync(filePath, 'utf-8')
const points = parseGpxPoints(xml)

if (points.length === 0) {
  console.error('Не найдено точек trkpt в файле')
  process.exit(1)
}

const simplified = rdp(points, epsilon)
console.error(`Исходных точек: ${points.length}, после упрощения: ${simplified.length}`)
console.log(JSON.stringify(simplified, null, 2))
