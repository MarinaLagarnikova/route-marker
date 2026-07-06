import type { LatLon } from '@/shared/lib/geo'
import type { Checkpoint } from '@/entities/checkpoint'

export interface MapAdapter {
  init(container: HTMLElement, center: LatLon, zoom: number): Promise<void>
  destroy(): void
  drawTrack(points: LatLon[], checkedUpToTrackIndex: number): void
  drawCheckpoints(checkpoints: Checkpoint[], onTap: (index: number) => void, showNumbers?: boolean): void
  updateUserPosition(pos: LatLon | null): void
  fitBounds(points: LatLon[]): void
  setLayer(layer: 'map' | 'satellite' | 'hybrid'): void
}
