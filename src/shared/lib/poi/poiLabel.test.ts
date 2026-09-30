import { describe, it, expect } from 'vitest'
import { poiLabel } from './poiLabel'
import type { RoutePoi } from './types'

const base: RoutePoi = {
  id: 'node/1', category: 'water', kind: 'spring', lat: 55, lon: 37, km: 4.2,
}

describe('poiLabel', () => {
  it('показывает имя из OSM, когда оно есть', () => {
    expect(poiLabel({ ...base, name: 'Святой источник' })).toEqual({
      title: 'Святой источник',
      subtitle: 'Родник · 4,2 км',
    })
  })

  it('безымянный объект подписывается по виду', () => {
    expect(poiLabel(base)).toEqual({ title: 'Родник', subtitle: '4,2 км' })
  })

  it('километраж округляется до десятых с запятой', () => {
    expect(poiLabel({ ...base, km: 0.04 }).subtitle).toBe('0 км')
    expect(poiLabel({ ...base, km: 12.36 }).subtitle).toBe('12,4 км')
  })
})
