export interface GeoPoint {
  lat: number
  lon: number
  ele?: number // elevation in metres
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type RouteType = 'linear' | 'loop' | 'out-and-back'

export interface RouteSource {
  name: string
  logoUrl?: string
  url: string
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
