import { parseGpx } from '@/shared/lib/gpx'
import type { LibraryCollection, GeoPoint } from '@/entities/library-route'

/**
 * Fetches collection metadata + trackSimplified for each route.
 * Full GPX tracks are NOT loaded here.
 */
export async function fetchCollection(id: string): Promise<LibraryCollection> {
  const res = await fetch(`/tracks/${id}/collection.json`)
  if (!res.ok) throw new Error(`Не удалось загрузить коллекцию: ${id}`)
  const data = await res.json()
  return data as LibraryCollection
}

/**
 * Fetches and parses a full GPX track for a route.
 * Returns array of points from trkpt segments.
 */
export async function fetchRouteGpx(
  collectionId: string,
  gpxFile: string
): Promise<GeoPoint[]> {
  const res = await fetch(`/tracks/${collectionId}/${gpxFile}`)
  if (!res.ok) throw new Error(`Не удалось загрузить трек: ${gpxFile}`)
  const xml = await res.text()
  const parsed = parseGpx(xml)
  return parsed.trackPoints.map((p) => ({ lat: p.lat, lon: p.lon }))
}
