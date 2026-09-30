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

export function isCircularRoute(track: LatLon[]): boolean {
  if (track.length < 3) return false
  const dists = cumulativeDistances(track)
  const totalKm = dists[dists.length - 1] ?? 0
  const threshold = Math.max(0.2, totalKm * 0.02)
  return haversineKm(track[0], track[track.length - 1]) <= threshold
}

export interface NearestPoint {
  index: number
  distanceKm: number
}

/** Ближайшая точка трека вместе с расстоянием — для отбора объектов по коридору. */
export function nearestTrackPoint(point: LatLon, track: LatLon[]): NearestPoint {
  let distanceKm = Infinity
  let index = 0
  for (let i = 0; i < track.length; i++) {
    const d = haversineKm(point, track[i])
    if (d < distanceKm) {
      distanceKm = d
      index = i
    }
  }
  return { index, distanceKm }
}

/**
 * Ближайшая к треку вершина контура. Болото или скалы в OSM — это полигон, и его
 * центр может лежать в километре от маршрута, тогда как задевает он трек краем.
 */
export function nearestContourPoint(
  contour: LatLon[],
  track: LatLon[],
): { point: LatLon; distanceKm: number; trackIndex: number } {
  let best = { point: contour[0], distanceKm: Infinity, trackIndex: 0 }
  for (const vertex of contour) {
    const { index, distanceKm } = nearestTrackPoint(vertex, track)
    if (distanceKm < best.distanceKm) {
      best = { point: vertex, distanceKm, trackIndex: index }
    }
  }
  return best
}

/** Координата на треке по километражу — с интерполяцией внутри отрезка. */
export function pointAtKm(track: LatLon[], km: number): LatLon {
  const dists = cumulativeDistances(track)
  const total = dists[dists.length - 1]
  if (km <= 0) return track[0]
  if (km >= total) return track[track.length - 1]

  let i = 1
  while (i < dists.length && dists[i] < km) i++

  const segmentKm = dists[i] - dists[i - 1]
  const ratio = segmentKm === 0 ? 0 : (km - dists[i - 1]) / segmentKm
  const a = track[i - 1]
  const b = track[i]
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lon: a.lon + (b.lon - a.lon) * ratio,
  }
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
