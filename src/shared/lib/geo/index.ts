export interface LatLon {
  lat: number
  lon: number
}

const R = 6371 // km

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function cumulativeDistances(points: LatLon[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    result.push(result[i - 1] + haversineKm(points[i - 1], points[i]))
  }
  return result
}

export function projectWptOnTrack(wpt: LatLon, track: LatLon[]): number {
  let minDist = Infinity
  let minIdx = 0
  for (let i = 0; i < track.length; i++) {
    const d = haversineKm(wpt, track[i])
    if (d < minDist) {
      minDist = d
      minIdx = i
    }
  }
  return minIdx
}
