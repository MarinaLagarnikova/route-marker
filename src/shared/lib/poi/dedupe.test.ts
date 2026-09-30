import { describe, it, expect } from 'vitest'
import { dedupeNearbyPois } from './dedupe'
import type { RoutePoi } from './types'

function poi(over: Partial<RoutePoi>): RoutePoi {
  return {
    id: 'node/1', category: 'heritage', kind: 'attraction',
    lat: 55.7, lon: 36.8, km: 9.8, ...over,
  }
}

describe('dedupeNearbyPois', () => {
  it('схлопывает одноимённые объекты рядом', () => {
    // «Братские корпуса» в OSM размечены двумя объектами
    const result = dedupeNearbyPois([
      poi({ id: 'way/1', name: 'Братские корпуса', lat: 55.7, lon: 36.8 }),
      poi({ id: 'way/2', name: 'Братские корпуса', lat: 55.7001, lon: 36.8001 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('way/1')
  })

  it('оставляет одноимённые объекты, если они далеко друг от друга', () => {
    const result = dedupeNearbyPois([
      poi({ id: 'node/1', name: 'Родник', kind: 'spring', category: 'water', lat: 55.70, lon: 36.80 }),
      poi({ id: 'node/2', name: 'Родник', kind: 'spring', category: 'water', lat: 55.72, lon: 36.80 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('не трогает безымянные объекты, даже стоящие вплотную', () => {
    // Три родника подряд на 7.8 км — это три разных родника, а не дубль
    const result = dedupeNearbyPois([
      poi({ id: 'node/1', category: 'water', kind: 'spring', lat: 55.7, lon: 36.8 }),
      poi({ id: 'node/2', category: 'water', kind: 'spring', lat: 55.70005, lon: 36.80005 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('не схлопывает одноимённые объекты разного вида', () => {
    const result = dedupeNearbyPois([
      poi({ id: 'node/1', name: 'Савва', kind: 'memorial', lat: 55.7, lon: 36.8 }),
      poi({ id: 'node/2', name: 'Савва', kind: 'museum', lat: 55.7, lon: 36.8 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('сохраняет порядок входного списка', () => {
    const result = dedupeNearbyPois([
      poi({ id: 'a', km: 1 }), poi({ id: 'b', km: 2 }), poi({ id: 'c', km: 3 }),
    ])
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})
