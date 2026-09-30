import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'
import type { RoutePoi } from '@/shared/lib/poi'

/** Фотография на карте. Координаты запечены на сборке — см. fetch-osm-pois.ts. */
export interface PhotoPin {
  src: string
  lat: number
  lon: number
}

export interface MapAdapter {
  init(container: HTMLElement, center: LatLon, zoom: number): Promise<void>
  destroy(): void
  drawTrack(points: LatLon[], checkedUpToTrackIndex: number, segments?: LatLon[][]): void
  drawCheckpoints(checkpoints: Checkpoint[], onTap: (index: number) => void, numbering?: 'all' | 'checked-only' | 'none'): void
  updateUserPosition(pos: LatLon | null): void
  /** Слой «Интересное»: объекты из OSM. Разрежением при наложении занимается карта. */
  drawPois(pois: RoutePoi[], onTap: (poi: RoutePoi) => void): Promise<void>
  /** Фотографии слоя — отдельным слоем поверх объектов, без вытеснения. */
  drawPhotoPins(photos: PhotoPin[], onTap: (index: number) => void): Promise<void>
  setOverlayVisible(visible: boolean): void
  /** Кнопка слоя в стеке контролов карты — рядом с зумом и геолокацией. */
  addOverlayToggle(initialVisible: boolean, onToggle: (visible: boolean) => void): void
  fitBounds(points: LatLon[]): void
  setLayer(layer: 'map' | 'satellite' | 'hybrid'): void
  zoomIn(): void
  zoomOut(): void
  panTo(pos: LatLon): void
}
