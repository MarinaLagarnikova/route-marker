import type { PoiCategory, PoiKind } from './types'

export type OsmTags = Record<string, string>

export interface PoiClassification {
  category: PoiCategory
  kind: PoiKind
}

/**
 * Таблица отбора: что из OSM попадает на слой. Состав собран по частотной
 * разведке вдоль треков библиотеки — всё, чего здесь нет, отсеивается.
 * Реки и озёра сознательно не берём: подложка рисует их сама.
 */
const TAG_MAP: Record<string, Record<string, PoiClassification>> = {
  natural: {
    spring: { category: 'water', kind: 'spring' },
    wetland: { category: 'caution', kind: 'wetland' },
    cliff: { category: 'caution', kind: 'cliff' },
    scree: { category: 'caution', kind: 'scree' },
    peak: { category: 'view', kind: 'peak' },
    saddle: { category: 'view', kind: 'saddle' },
    cave_entrance: { category: 'view', kind: 'cave' },
    rock: { category: 'view', kind: 'rock' },
    arch: { category: 'view', kind: 'rock' },
  },
  amenity: {
    drinking_water: { category: 'water', kind: 'drinking_water' },
    shelter: { category: 'camp', kind: 'shelter' },
  },
  man_made: {
    water_well: { category: 'water', kind: 'well' },
  },
  tourism: {
    camp_site: { category: 'camp', kind: 'camp_site' },
    wilderness_hut: { category: 'camp', kind: 'hut' },
    alpine_hut: { category: 'camp', kind: 'hut' },
    picnic_site: { category: 'camp', kind: 'picnic_site' },
    viewpoint: { category: 'view', kind: 'viewpoint' },
    attraction: { category: 'heritage', kind: 'attraction' },
    museum: { category: 'heritage', kind: 'museum' },
    artwork: { category: 'heritage', kind: 'artwork' },
    information: { category: 'signage', kind: 'information' },
  },
  leisure: {
    firepit: { category: 'camp', kind: 'firepit' },
  },
  historic: {
    memorial: { category: 'heritage', kind: 'memorial' },
    monument: { category: 'heritage', kind: 'monument' },
    ruins: { category: 'heritage', kind: 'ruins' },
    manor: { category: 'heritage', kind: 'manor' },
    archaeological_site: { category: 'heritage', kind: 'archaeology' },
  },
  waterway: {
    waterfall: { category: 'view', kind: 'waterfall' },
  },
  mountain_pass: {
    yes: { category: 'view', kind: 'mountain_pass' },
  },
  ford: {
    yes: { category: 'caution', kind: 'ford' },
  },
  shop: {
    convenience: { category: 'supply', kind: 'shop' },
    supermarket: { category: 'supply', kind: 'shop' },
    grocery: { category: 'supply', kind: 'shop' },
    general: { category: 'supply', kind: 'shop' },
  },
}

/** Порядок разбора: первый совпавший ключ и решает. */
const KEY_ORDER = [
  'natural', 'amenity', 'man_made', 'tourism', 'leisure',
  'historic', 'waterway', 'mountain_pass', 'ford', 'shop',
]

/** Указатели тропы берём, музейные таблички — нет: в Звенигороде их оказалось двадцать. */
const USEFUL_SIGNAGE = ['guidepost', 'route_marker']

export function categorizeOsmTags(tags: OsmTags): PoiClassification | null {
  // Навес на автобусной остановке — не место привала, хотя тег тот же
  if (tags.amenity === 'shelter' && tags.shelter_type === 'public_transport') return null
  if (tags.tourism === 'information' && !USEFUL_SIGNAGE.includes(tags.information)) return null

  for (const key of KEY_ORDER) {
    const value = tags[key]
    if (!value) continue
    const hit = TAG_MAP[key]?.[value]
    if (!hit) continue
    // Безымянный памятник или музей на карте — это подпись «Памятник» и больше
    // ничего. У родника или брода имени не бывает, и оно им не нужно.
    if (hit.category === 'heritage' && !tags.name) return null
    return hit
  }
  return null
}
