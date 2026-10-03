import { describe, it, expect } from 'vitest'
import { applyExclusions } from './exclude'
import type { RoutePoi } from './types'

function poi(kind: string, id = kind): RoutePoi {
  return { id, kind, category: 'water', lat: 0, lon: 0, km: 0 } as unknown as RoutePoi
}

describe('отсев видов для отдельного маршрута', () => {
  // Брод, болото и родник осмысленны в лесу и странны посреди города: там они
  // либо декоративные, либо никому не нужны. Это свойство маршрута, а не вида,
  // поэтому список живёт в данных маршрута, а не в общей таблице отбора
  it('выбрасывает перечисленные виды', () => {
    const pois = [poi('ford'), poi('shop'), poi('wetland'), poi('spring'), poi('memorial')]
    const kept = applyExclusions(pois, ['ford', 'wetland', 'spring'])
    expect(kept.map((p) => p.kind)).toEqual(['shop', 'memorial'])
  })

  it('без списка не трогает ничего', () => {
    const pois = [poi('ford'), poi('shop')]
    expect(applyExclusions(pois, undefined)).toHaveLength(2)
    expect(applyExclusions(pois, [])).toHaveLength(2)
  })

  it('незнакомый вид в списке никому не мешает', () => {
    const pois = [poi('ford'), poi('shop')]
    expect(applyExclusions(pois, ['nothing-like-this']).map((p) => p.kind)).toEqual(['ford', 'shop'])
  })

  it('не меняет исходный список', () => {
    const pois = [poi('ford'), poi('shop')]
    applyExclusions(pois, ['ford'])
    expect(pois).toHaveLength(2)
  })
})
