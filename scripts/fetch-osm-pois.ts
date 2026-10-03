#!/usr/bin/env tsx
/**
 * Собирает объекты слоя «Интересное» из OpenStreetMap вдоль треков библиотеки.
 * Usage: npx tsx scripts/fetch-osm-pois.ts <route-id | region-id | --all>
 *                                          [--dry] [--local] [--force]
 *
 * Результат дописывается в public/tracks/<region>/collection.json полем `pois`
 * и заодно пересчитывает координаты фотографий по их километражу.
 *
 * Прогон рассчитан на обрыв. Overpass отказывает подолгу и без предупреждения,
 * поэтому: пишем после каждого маршрута, а не в конце региона; упавший маршрут
 * не роняет остальные; повторный запуск той же команды пропускает уже добытое и
 * доедает остаток. Перезабрать добытое заново — `--force`.
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
  bearingAtKm,
  type LatLon,
} from '../src/shared/lib/geo'
import { categorizeOsmTags, type OsmTags } from '../src/shared/lib/poi/categorize'
import { CATEGORY_PRIORITY } from '../src/shared/lib/poi/types'
import { dedupeNearbyPois } from '../src/shared/lib/poi/dedupe'
import { applyExclusions } from '../src/shared/lib/poi/exclude'
import type { RoutePoi } from '../src/shared/lib/poi/types'
import { matchesTarget, skipReason } from './poi-plan'
import { parseOverpassBody } from './overpass-body'

const TRACKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tracks')
const CORRIDOR_KM = 0.15
const ANCHOR_STEP_KM = 0.12
const CHUNK_ANCHORS = 150
const PAD_DEG = 0.003
/** Пауза между запросами: Overpass общий, и ломиться в него подряд невежливо. */
const REQUEST_GAP_MS = 2000
/** Пауза между маршрутами — та же вежливость, но крупнее. */
const ROUTE_GAP_MS = 5000
/**
 * Повторы коротки намеренно. Пока записи не было до конца региона, долгая
 * лестница имела смысл: сдаться значило потерять всё добытое. С чекпоинтами
 * дешевле упасть быстро, записать остальное и вернуться позже — на «Каменных
 * озёрах» прежние шесть попыток с паузами до трёх минут держали процесс
 * четверть часа и всё равно ничего не добыли.
 */
const MAX_ATTEMPTS = 3
const RETRY_WAIT_MS = 10_000
/** Сам запрос объявляет `[timeout:120]`, ждать дольше сервера бессмысленно. */
const REQUEST_TIMEOUT_S = 150
/**
 * Зеркала чередуются по попыткам, поэтому мёртвое съедает половину из них.
 * `overpass.kumi.systems` отсюда не отвечает вовсе (таймаут на 30с), а
 * `overpass.osm.ch` оказался швейцарским срезом: на тот же запрос 272 байта
 * против 7965 — отвечает бодро, а данных по России в нём нет.
 * Проверять зеркало надо не кодом ответа, а объёмом на знакомом запросе.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
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
    photos?: Array<{
      src: string; caption?: string; km?: number
      lat?: number; lon?: number
      /** Направление тропы в точке съёмки — плашка отводится поперёк него. */
      bearing?: number
    }>
    pois?: RoutePoi[]
    /** Виды, которые этому маршруту не нужны: см. shared/lib/poi/exclude. */
    poiExclude?: string[]
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

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function askOverpass(query: string, attempt = 1): Promise<OverpassElement[]> {
  const endpoint = MIRRORS[(attempt - 1) % MIRRORS.length]
  try {
    const raw = execFileSync(
      'curl',
      ['-s', '--max-time', String(REQUEST_TIMEOUT_S), '-A', 'veshka-pois/1.0 (route library)',
       '--data-binary', '@-', endpoint],
      { input: query, maxBuffer: 128 * 1024 * 1024, encoding: 'utf-8' },
    )
    return parseOverpassBody(raw) as unknown as OverpassElement[]
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Overpass не ответил: ${reason}`)
    const waitMs = RETRY_WAIT_MS * attempt
    console.error(`  … ${reason}; повтор через ${waitMs / 1000}с`)
    await pause(waitMs)
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
    if (i > 0) await pause(REQUEST_GAP_MS)
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

const USAGE = 'Usage: npx tsx scripts/fetch-osm-pois.ts'
  + ' <route-id | region-id | --all> [--dry] [--local] [--force]'

async function main() {
  const [target, ...flags] = process.argv.slice(2)
  const dryRun = flags.includes('--dry')
  // Пересчёт по уже запечённым данным, без Overpass. Нужен, когда поменялась не
  // добыча, а модель: выброшена категория или у фотографий появилось новое поле.
  // Ходить за объектами заново в такие моменты вредно — набор перетряхнётся
  // против сегодняшнего OSM вместе с правкой, к которой это не относится.
  const localOnly = flags.includes('--local')
  const force = flags.includes('--force')
  if (!target || target.startsWith('--') && target !== '--all') {
    console.error(USAGE)
    process.exit(1)
  }

  const done: string[] = []
  const skipped: string[] = []
  const failed: string[] = []
  let matched = 0
  let firstNetworkRoute = true

  for (const region of readdirSync(TRACKS_DIR)) {
    const collectionPath = join(TRACKS_DIR, region, 'collection.json')
    if (!existsSync(collectionPath)) continue

    const collection = JSON.parse(readFileSync(collectionPath, 'utf-8')) as CollectionFile

    for (const route of collection.routes) {
      if (!matchesTarget(target, region, route.id)) continue
      matched++
      if (!route.gpx) {
        skipped.push(`${route.id}: в подборке нет файла трека`)
        continue
      }

      const skip = skipReason(route, { force, localOnly })
      if (skip) {
        skipped.push(`${route.id}: ${skip}`)
        continue
      }

      const gpxPath = join(TRACKS_DIR, region, route.gpx)
      const track = parseTrack(gpxPath)
      if (track.length < 2) {
        // Битый трек — не редкость: качалка кладёт страницу ошибки под именем
        // GPX, и файл в 23 байта выглядит как файл
        skipped.push(`${route.id}: в треке нет точек (${route.gpx})`)
        console.error(`! ${route.id}: в треке нет точек, пропускаю`)
        continue
      }

      // Падение одного маршрута не должно уносить остальные: Overpass отказывает
      // надолго и выборочно, а добытое до обрыва уже записано на диск
      let pois: RoutePoi[]
      try {
        if (localOnly) {
          // Категория, выброшенная из модели, остаётся в запечённых данных и без
          // значка на карте не рисуется — чистим её тем же проходом
          pois = (route.pois ?? []).filter((poi) => poi.category in CATEGORY_PRIORITY)
        } else {
          if (!firstNetworkRoute) await pause(ROUTE_GAP_MS)
          firstNetworkRoute = false
          pois = await collectPois(track, route.id)
        }
        // Отсев, назначенный маршруту, применяем в обоих режимах: иначе
        // перезабор вернул бы выброшенное обратно
        pois = applyExclusions(pois, route.poiExclude)
      } catch (error) {
        failed.push(`${route.id}: ${error instanceof Error ? error.message : String(error)}`)
        console.error(`! ${route.id}: ${String(error)}`)
        continue
      }
      route.pois = pois

      // Координаты фотографий считаем здесь же: в рантайме полного трека нет.
      // Направление тропы — тоже: на карте подборки трек упрощён до десятков
      // точек, и беаринг по нему вышел бы грубым.
      let photosPlaced = 0
      for (const photo of route.photos ?? []) {
        if (photo.km === undefined) continue
        const position = pointAtKm(track, photo.km)
        photo.lat = Number(position.lat.toFixed(6))
        photo.lon = Number(position.lon.toFixed(6))
        photo.bearing = Number(bearingAtKm(track, photo.km).toFixed(1))
        photosPlaced++
      }

      const byCategory = pois.reduce<Record<string, number>>((acc, poi) => {
        acc[poi.category] = (acc[poi.category] ?? 0) + 1
        return acc
      }, {})
      console.log(`${route.id}: ${pois.length} объектов, ${photosPlaced} фото на треке`)
      console.log('  ', JSON.stringify(byCategory, null, 0))

      // Чекпоинт: пишем сразу, иначе обрыв на середине региона съедает всё, что
      // добыто до него
      if (!dryRun) {
        writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf-8')
      }
      done.push(route.id)
    }
  }

  if (matched === 0) {
    console.error(`! под цель «${target}» не подошёл ни один маршрут\n${USAGE}`)
    process.exit(1)
  }

  console.log(`\nИтог: добыто ${done.length}, пропущено ${skipped.length}, упало ${failed.length}`)
  for (const line of skipped) console.log(`  пропуск — ${line}`)
  for (const line of failed) console.log(`  падение — ${line}`)
  if (failed.length > 0) {
    console.log(`\nПовторите ту же команду — добытое пропустится, остаток доедется.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
