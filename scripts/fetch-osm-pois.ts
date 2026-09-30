#!/usr/bin/env tsx
/**
 * Собирает объекты слоя «Интересное» из OpenStreetMap вдоль треков библиотеки.
 * Usage: npx tsx scripts/fetch-osm-pois.ts <route-id | --all> [--dry]
 *
 * Результат дописывается в public/tracks/<region>/collection.json полем `pois`
 * и заодно пересчитывает координаты фотографий по их километражу.
 *
 * Про Overpass, ценой часа таймаутов:
 *  - регексп по КЛЮЧУ (`[~"^(natural|tourism)$"~"."]`) не использует индекс
 *    тегов, запрос уходит в полное сканирование квадрата и отваливается по 504;
 *  - фильтр `around` с сотней координат считается минутами.
 * Рабочая форма — bbox с явным перечислением ключей, а коридор вдоль трека
 * отсекается уже локально.
 */

import { readFileSync, writeFileSync } from 'fs'
import { readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import {
  haversineKm,
  cumulativeDistances,
  nearestTrackPoint,
  nearestContourPoint,
  pointAtKm,
  type LatLon,
} from '../src/shared/lib/geo'
import { categorizeOsmTags, type OsmTags } from '../src/shared/lib/poi/categorize'
import { dedupeNearbyPois } from '../src/shared/lib/poi/dedupe'
import type { RoutePoi } from '../src/shared/lib/poi/types'

const TRACKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tracks')
const CORRIDOR_KM = 0.15
const ANCHOR_STEP_KM = 0.12
const CHUNK_ANCHORS = 150
const PAD_DEG = 0.003
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Что спрашиваем у Overpass. Значения перечислены явно — так работает индекс. */
const TAG_FILTERS = [
  'natural~"^(spring|wetland|cliff|scree|peak|saddle|cave_entrance|rock|arch)$"',
  'amenity~"^(drinking_water|shelter)$"',
  'man_made=water_well',
  'tourism~"^(camp_site|wilderness_hut|alpine_hut|picnic_site|viewpoint|attraction|museum|artwork|information)$"',
  'leisure=firepit',
  'historic~"^(memorial|monument|ruins|manor|archaeological_site)$"',
  'waterway=waterfall',
  'mountain_pass=yes',
  'ford',
  'shop~"^(convenience|supermarket|grocery|general)$"',
]

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  geometry?: LatLon[]
  tags?: OsmTags
}

interface CollectionFile {
  routes: Array<{
    id: string
    name: string
    gpx?: string
    photos?: Array<{ src: string; caption?: string; km?: number; lat?: number; lon?: number }>
    pois?: RoutePoi[]
    [key: string]: unknown
  }>
  [key: string]: unknown
}

function parseTrack(gpxPath: string): LatLon[] {
  const raw = readFileSync(gpxPath, 'utf-8')
  const points: LatLon[] = []
  const re = /<(?:trkpt|rtept)\s+([^>]*)>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const lat = /lat="([\d.-]+)"/.exec(match[1])?.[1]
    const lon = /lon="([\d.-]+)"/.exec(match[1])?.[1]
    if (lat && lon) points.push({ lat: Number(lat), lon: Number(lon) })
  }
  return points
}

/** Прореживаем трек: bbox строится по якорям, каждая точка подряд не нужна. */
function anchors(track: LatLon[]): LatLon[] {
  const result: LatLon[] = [track[0]]
  for (const point of track.slice(1)) {
    if (haversineKm(result[result.length - 1], point) >= ANCHOR_STEP_KM) result.push(point)
  }
  const last = track[track.length - 1]
  if (result[result.length - 1] !== last) result.push(last)
  return result
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    // нахлёст в одну точку, чтобы на стыке кусков ничего не выпало
    out.push(items.slice(Math.max(0, i - 1), i + size))
  }
  return out
}

function buildQuery(points: LatLon[]): string {
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const bbox = [
    Math.min(...lats) - PAD_DEG, Math.min(...lons) - PAD_DEG,
    Math.max(...lats) + PAD_DEG, Math.max(...lons) + PAD_DEG,
  ].map((n) => n.toFixed(5)).join(',')

  const body = TAG_FILTERS
    .map((filter) => `node[${filter}](${bbox});\nway[${filter}](${bbox});`)
    .join('\n')
  return `[out:json][timeout:120];\n(\n${body}\n);\nout tags geom;`
}

async function askOverpass(query: string, attempt = 1): Promise<OverpassElement[]> {
  const endpoint = MIRRORS[(attempt - 1) % MIRRORS.length]
  try {
    const raw = execFileSync(
      'curl',
      ['-s', '--max-time', '300', '-A', 'veshka-pois/1.0 (route library)',
       '--data-binary', '@-', endpoint],
      { input: query, maxBuffer: 128 * 1024 * 1024, encoding: 'utf-8' },
    )
    return (JSON.parse(raw) as { elements: OverpassElement[] }).elements ?? []
  } catch (error) {
    if (attempt >= 6) throw new Error(`Overpass не ответил: ${String(error)}`)
    const waitMs = Math.min(30_000 * attempt, 180_000)
    console.error(`  … Overpass молчит, повтор через ${waitMs / 1000}с`)
    await new Promise((r) => setTimeout(r, waitMs))
    return askOverpass(query, attempt + 1)
  }
}

/** Координата объекта и его место на треке; для контуров — ближайшая вершина. */
function locate(element: OverpassElement, track: LatLon[]) {
  if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
    const point = { lat: element.lat, lon: element.lon }
    const { index, distanceKm } = nearestTrackPoint(point, track)
    return { point, distanceKm, trackIndex: index }
  }
  if (element.geometry?.length) {
    return nearestContourPoint(element.geometry, track)
  }
  return null
}

async function collectPois(track: LatLon[], label: string): Promise<RoutePoi[]> {
  const cumulative = cumulativeDistances(track)
  const seen = new Map<string, RoutePoi>()
  const parts = chunk(anchors(track), CHUNK_ANCHORS)

  for (const [i, part] of parts.entries()) {
    process.stderr.write(`  ${label}: запрос ${i + 1}/${parts.length}\n`)
    const elements = await askOverpass(buildQuery(part))
    for (const element of elements) {
      const id = `${element.type}/${element.id}`
      if (seen.has(id)) continue
      const classification = categorizeOsmTags(element.tags ?? {})
      if (!classification) continue
      const located = locate(element, track)
      if (!located || located.distanceKm > CORRIDOR_KM) continue

      seen.set(id, {
        id,
        category: classification.category,
        kind: classification.kind,
        ...(element.tags?.name ? { name: element.tags.name } : {}),
        lat: Number(located.point.lat.toFixed(6)),
        lon: Number(located.point.lon.toFixed(6)),
        km: Number(cumulative[located.trackIndex].toFixed(2)),
      })
    }
  }

  const sorted = [...seen.values()].sort((a, b) => a.km - b.km)
  return dedupeNearbyPois(sorted)
}

async function main() {
  const [target, ...flags] = process.argv.slice(2)
  const dryRun = flags.includes('--dry')
  if (!target) {
    console.error('Usage: npx tsx scripts/fetch-osm-pois.ts <route-id | --all> [--dry]')
    process.exit(1)
  }

  for (const region of readdirSync(TRACKS_DIR)) {
    const collectionPath = join(TRACKS_DIR, region, 'collection.json')
    if (!existsSync(collectionPath)) continue

    const collection = JSON.parse(readFileSync(collectionPath, 'utf-8')) as CollectionFile
    let changed = false

    for (const route of collection.routes) {
      if (target !== '--all' && route.id !== target) continue
      if (!route.gpx) continue

      const gpxPath = join(TRACKS_DIR, region, route.gpx)
      const track = parseTrack(gpxPath)
      if (track.length < 2) {
        console.error(`! ${route.id}: в треке нет точек, пропускаю`)
        continue
      }

      const pois = await collectPois(track, route.id)
      route.pois = pois

      // Координаты фотографий считаем здесь же: в рантайме полного трека нет
      let photosPlaced = 0
      for (const photo of route.photos ?? []) {
        if (photo.km === undefined) continue
        const position = pointAtKm(track, photo.km)
        photo.lat = Number(position.lat.toFixed(6))
        photo.lon = Number(position.lon.toFixed(6))
        photosPlaced++
      }

      changed = true
      const byCategory = pois.reduce<Record<string, number>>((acc, poi) => {
        acc[poi.category] = (acc[poi.category] ?? 0) + 1
        return acc
      }, {})
      console.log(`${route.id}: ${pois.length} объектов, ${photosPlaced} фото на треке`)
      console.log('  ', JSON.stringify(byCategory, null, 0))
    }

    if (changed && !dryRun) {
      writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf-8')
      console.log(`записано: ${collectionPath}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
