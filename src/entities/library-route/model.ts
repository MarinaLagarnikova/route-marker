import type { RoutePoi } from '@/shared/lib/poi'

export interface GeoPoint {
  lat: number
  lon: number
  ele?: number // elevation in metres
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type RouteType = 'linear' | 'loop' | 'out-and-back'

export interface RouteSource {
  name: string
  /** First line of the attribution block; falls back to `name`. */
  tagline?: string
  /** Second line. Linked sources fall back to a "read more" prompt. */
  note?: string
  logoUrl?: string
  /** Omitted for our own routes: everything about them is already in the drawer. */
  url?: string
}

export interface RoutePhoto {
  /** Path from the site root: /tracks/<region>/<route-id>/photo-1.jpg */
  src: string
  caption?: string
  /** Where along the track the shot was taken, km. Derived from the photo's GPS. */
  km?: number
  /**
   * Position on the map, baked from `km` by scripts/fetch-osm-pois.ts.
   * Not derived at runtime: the collection map only has the simplified track,
   * and a kilometre mark projected onto 17 points lands in the wrong place.
   */
  lat?: number
  lon?: number
  /**
   * Направление тропы в точке съёмки, градусы от севера. Запекается там же:
   * плашка отводится поперёк тропы, чтобы не лечь на линию трека.
   */
  bearing?: number
}

export interface LibraryRoute {
  id: string
  name: string
  region: { id: string; name: string }
  distanceKm: number
  durationLabel: string // e.g. "3—4 дня"
  difficulty: Difficulty
  elevationGainM: number
  type: RouteType
  nearestSettlement?: string
  description: string
  highlights?: string[]
  photos?: RoutePhoto[]
  /** Объекты слоя «Интересное» из OSM, запечённые на этапе сборки данных. */
  pois?: RoutePoi[]
  gpx?: string
  source: RouteSource
  track?: GeoPoint[]          // full geometry for drawer/map
  trackSimplified: GeoPoint[] // simplified for card thumbnails and region mini-map
}

export interface LibraryCollection {
  id: string
  name: string
  totalRoutes: number
  routes: LibraryRoute[]
}
