#!/usr/bin/env tsx
/**
 * Simplifies a GPX track using the Ramer-Douglas-Peucker algorithm.
 * Usage: npx tsx scripts/simplify-gpx.ts ./path/to/file.gpx [epsilon]
 * epsilon — simplification threshold in degrees (default: 0.001 ≈ ~100m)
 * Outputs JSON array of { lat, lon } points to stdout (for trackSimplified)
 * Stats printed to stderr
 */

import { readFileSync } from 'fs'

interface Point { lat: number; lon: number }

function parseGpxPoints(xml: string): Point[] {
  const points: Point[] = []
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]) })
  }
  // fallback: try lon before lat attribute order
  if (points.length === 0) {
    const regex2 = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"/g
    while ((m = regex2.exec(xml)) !== null) {
      points.push({ lat: parseFloat(m[2]), lon: parseFloat(m[1]) })
    }
  }
  return points
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
