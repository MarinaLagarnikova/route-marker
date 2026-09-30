/** Категория объекта на слое «Интересное». Иконка задаётся категорией. */
export type PoiCategory =
  | 'water'     // питьевая вода
  | 'camp'      // ночёвка и привал
  | 'caution'   // осторожно
  | 'view'      // посмотреть
  | 'heritage'  // рукотворное
  | 'signage'   // маркировка
  | 'supply'    // снабжение

/** Конкретный вид объекта — нужен для подписи, когда у объекта нет имени в OSM. */
export type PoiKind =
  | 'spring' | 'drinking_water' | 'well'
  | 'camp_site' | 'hut' | 'picnic_site' | 'shelter' | 'firepit'
  | 'ford' | 'wetland' | 'cliff' | 'scree'
  | 'peak' | 'saddle' | 'cave' | 'rock' | 'mountain_pass' | 'viewpoint' | 'waterfall'
  | 'memorial' | 'monument' | 'ruins' | 'manor' | 'archaeology' | 'attraction' | 'museum' | 'artwork'
  | 'information'
  | 'shop'

export interface RoutePoi {
  /** Идентификатор объекта в OSM: `node/123456` — по нему объект переживает перегон данных. */
  id: string
  category: PoiCategory
  kind: PoiKind
  /** Имя из OSM, если оно есть. Безымянные подписываются по виду. */
  name?: string
  lat: number
  lon: number
  /** Километраж по треку — показывается в шторке объекта. */
  km: number
}

export const CATEGORY_LABELS: Record<PoiCategory, string> = {
  water: 'Питьевая вода',
  camp: 'Ночёвка и привал',
  caution: 'Осторожно',
  view: 'Посмотреть',
  heritage: 'Рукотворное',
  signage: 'Маркировка',
  supply: 'Снабжение',
}

/**
 * Вес вытеснения при наложении значков: чем меньше, тем важнее. Уходит в
 * `symbol-sort-key` карты — разрежением занимается сам движок.
 */
export const CATEGORY_PRIORITY: Record<PoiCategory, number> = {
  water: 1,
  camp: 2,
  caution: 3,
  supply: 4,
  view: 5,
  heritage: 6,
  signage: 7,
}

export const KIND_LABELS: Record<PoiKind, string> = {
  spring: 'Родник',
  drinking_water: 'Питьевая вода',
  well: 'Колодец',
  camp_site: 'Стоянка',
  hut: 'Приют',
  picnic_site: 'Место для привала',
  shelter: 'Навес',
  firepit: 'Кострище',
  ford: 'Брод',
  wetland: 'Болото',
  cliff: 'Обрыв',
  scree: 'Осыпь',
  peak: 'Вершина',
  saddle: 'Седловина',
  cave: 'Пещера',
  rock: 'Скала',
  mountain_pass: 'Перевал',
  viewpoint: 'Видовая точка',
  waterfall: 'Водопад',
  memorial: 'Памятник',
  monument: 'Монумент',
  ruins: 'Руины',
  manor: 'Усадьба',
  archaeology: 'Археологический памятник',
  attraction: 'Достопримечательность',
  museum: 'Музей',
  artwork: 'Арт-объект',
  information: 'Информационный щит',
  shop: 'Магазин',
}
