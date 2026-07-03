import type { LatLon } from '@/shared/lib/geo'

export interface GpxWaypoint extends LatLon {
  name: string
}

export interface GpxData {
  name: string
  trackPoints: LatLon[]
  waypoints: GpxWaypoint[]
}

export function parseGpx(xml: string): GpxData {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Файл повреждён: не удалось разобрать XML')

  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  const rtepts = Array.from(doc.querySelectorAll('rtept'))
  const rawPoints = trkpts.length ? trkpts : rtepts

  if (rawPoints.length < 2) {
    throw new Error('GPX-файл не содержит трека (нужно минимум 2 точки trkpt/rtept)')
  }

  const trackPoints: LatLon[] = rawPoints.map((el) => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
  }))

  const waypoints: GpxWaypoint[] = Array.from(doc.querySelectorAll('wpt')).map((el) => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    name: el.querySelector('name')?.textContent?.trim() ?? 'Точка',
  }))

  const metaName = doc.querySelector('metadata > name')?.textContent?.trim()
  const trkName = doc.querySelector('trk > name')?.textContent?.trim()
  const name = metaName ?? trkName ?? ''

  return { name, trackPoints, waypoints }
}
