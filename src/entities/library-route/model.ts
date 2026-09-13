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
  /** Paths under /tracks/<region>/photos/, shown as a gallery in the detail drawer. */
  photos?: string[]
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
