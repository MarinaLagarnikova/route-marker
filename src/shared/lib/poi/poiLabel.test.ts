import { describe, it, expect } from 'vitest'
import { poiLabel } from './poiLabel'
import type { RoutePoi } from './types'

const base: RoutePoi = {
  id: 'node/1', category: 'water', kind: 'spring', lat: 55, lon: 37, km: 4.2,
}

describe('poiLabel', () => {
  it('показывает имя из OSM, когда оно есть', () => {
    expect(poiLabel({ ...base, name: 'Святой источник' })).toBe('Святой источник')
  })

  it('безымянный объект подписывается по виду', () => {
    expect(poiLabel(base)).toBe('Родник')
  })

  // Вторую строку шторки занимает название группы, и повтор там ни к чему
  it('пустое имя не считается именем', () => {
    expect(poiLabel({ ...base, name: '' })).toBe('Родник')
  })
})
