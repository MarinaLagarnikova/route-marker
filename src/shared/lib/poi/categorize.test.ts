import { describe, it, expect } from 'vitest'
import { categorizeOsmTags, type OsmTags } from './categorize'
import { CATEGORY_PRIORITY, KIND_LABELS } from './types'

describe('categorizeOsmTags — что берём', () => {
  it('родник — питьевая вода', () => {
    expect(categorizeOsmTags({ natural: 'spring' })).toEqual({ category: 'water', kind: 'spring' })
  })

  it('питьевая колонка и колодец — тоже вода', () => {
    expect(categorizeOsmTags({ amenity: 'drinking_water' })?.category).toBe('water')
    expect(categorizeOsmTags({ man_made: 'water_well' })?.category).toBe('water')
  })

  it('стоянка и приют — ночёвка', () => {
    expect(categorizeOsmTags({ tourism: 'camp_site' })).toEqual({ category: 'camp', kind: 'camp_site' })
    expect(categorizeOsmTags({ tourism: 'wilderness_hut' })?.category).toBe('camp')
  })

  it('брод и болото — осторожно', () => {
    expect(categorizeOsmTags({ ford: 'yes' })).toEqual({ category: 'caution', kind: 'ford' })
    expect(categorizeOsmTags({ natural: 'wetland' })).toEqual({ category: 'caution', kind: 'wetland' })
  })

  it('вершина, перевал, водопад и видовая точка — природа', () => {
    expect(categorizeOsmTags({ natural: 'peak' })?.category).toBe('nature')
    expect(categorizeOsmTags({ mountain_pass: 'yes' })?.category).toBe('nature')
    expect(categorizeOsmTags({ tourism: 'viewpoint' })?.category).toBe('nature')
    expect(categorizeOsmTags({ waterway: 'waterfall' })?.category).toBe('nature')
  })

  it('памятник и музей — рукотворное, если у них есть имя', () => {
    expect(categorizeOsmTags({ historic: 'memorial', name: 'А. П. Чехову' })?.category).toBe('heritage')
    expect(categorizeOsmTags({ tourism: 'museum', name: 'Дом А. П. Чехова' })?.category).toBe('heritage')
  })

  it('продуктовый магазин — снабжение', () => {
    expect(categorizeOsmTags({ shop: 'convenience' })?.category).toBe('supply')
    expect(categorizeOsmTags({ shop: 'supermarket' })?.category).toBe('supply')
  })
})

describe('categorizeOsmTags — что отсеиваем', () => {
  it('почвопокров: лес, кустарник, трава', () => {
    expect(categorizeOsmTags({ natural: 'wood' })).toBeNull()
    expect(categorizeOsmTags({ natural: 'scrub' })).toBeNull()
    expect(categorizeOsmTags({ natural: 'grassland' })).toBeNull()
  })

  it('реки и озёра — они и так нарисованы на подложке', () => {
    expect(categorizeOsmTags({ natural: 'water' })).toBeNull()
    expect(categorizeOsmTags({ waterway: 'stream' })).toBeNull()
    expect(categorizeOsmTags({ waterway: 'river' })).toBeNull()
  })

  it('городская инфраструктура', () => {
    expect(categorizeOsmTags({ amenity: 'parking' })).toBeNull()
    expect(categorizeOsmTags({ amenity: 'bench' })).toBeNull()
    expect(categorizeOsmTags({ emergency: 'fire_hydrant' })).toBeNull()
    expect(categorizeOsmTags({ man_made: 'tower' })).toBeNull()
    expect(categorizeOsmTags({ amenity: 'cafe' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'hotel' })).toBeNull()
  })

  it('непродуктовые магазины не считаются снабжением', () => {
    expect(categorizeOsmTags({ shop: 'rental' })).toBeNull()
    expect(categorizeOsmTags({ shop: 'hairdresser' })).toBeNull()
  })

  it('автобусная остановка — не привал, хотя и shelter', () => {
    expect(categorizeOsmTags({ amenity: 'shelter', shelter_type: 'public_transport' })).toBeNull()
    expect(categorizeOsmTags({ amenity: 'shelter', shelter_type: 'picnic_shelter' })?.category).toBe('camp')
    expect(categorizeOsmTags({ amenity: 'shelter' })?.category).toBe('camp')
  })

  it('любая придорожная информация, включая указатели тропы', () => {
    // Указатель человеку, идущему по готовому треку с контрольными точками,
    // ничего не добавляет: на Звенигороде их было 13 из 50 объектов
    expect(categorizeOsmTags({ tourism: 'information', information: 'guidepost' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'information', information: 'route_marker' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'information', information: 'board' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'information' })).toBeNull()
  })

  it('безымянное рукотворное: подпись «Памятник» не стоит значка', () => {
    expect(categorizeOsmTags({ historic: 'memorial' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'museum' })).toBeNull()
    expect(categorizeOsmTags({ tourism: 'attraction' })).toBeNull()
  })

  it('безымянность не мешает природным объектам и воде', () => {
    expect(categorizeOsmTags({ natural: 'spring' })?.category).toBe('water')
    expect(categorizeOsmTags({ ford: 'yes' })?.category).toBe('caution')
    expect(categorizeOsmTags({ tourism: 'camp_site' })?.category).toBe('camp')
  })

  it('объект без интересных тегов', () => {
    expect(categorizeOsmTags({})).toBeNull()
    expect(categorizeOsmTags({ name: 'Просто что-то', building: 'yes' })).toBeNull()
  })
})

describe('приоритет категорий', () => {
  it('вода вытесняет всё остальное при наложении', () => {
    const others = Object.entries(CATEGORY_PRIORITY).filter(([c]) => c !== 'water')
    for (const [, weight] of others) {
      expect(CATEGORY_PRIORITY.water).toBeLessThan(weight)
    }
  })

  it('наследие уступает ночёвке и предупреждениям', () => {
    expect(CATEGORY_PRIORITY.heritage).toBeGreaterThan(CATEGORY_PRIORITY.camp)
    expect(CATEGORY_PRIORITY.heritage).toBeGreaterThan(CATEGORY_PRIORITY.caution)
  })
})

describe('подписи', () => {
  it('у каждого распознаваемого вида есть русское название', () => {
    const kinds: OsmTags[] = [
      { natural: 'spring' }, { amenity: 'drinking_water' }, { man_made: 'water_well' },
      { tourism: 'camp_site' }, { tourism: 'wilderness_hut' }, { tourism: 'picnic_site' },
      { amenity: 'shelter' }, { leisure: 'firepit' }, { ford: 'yes' },
      { natural: 'wetland' }, { natural: 'cliff' }, { natural: 'scree' },
      { natural: 'peak' }, { natural: 'saddle' }, { natural: 'cave_entrance' },
      { mountain_pass: 'yes' }, { tourism: 'viewpoint' }, { waterway: 'waterfall' },
      { historic: 'memorial', name: 'Памятник' }, { historic: 'ruins', name: 'Руины' },
      { tourism: 'museum', name: 'Музей' },
      { shop: 'convenience' },
    ]
    for (const tags of kinds) {
      const result = categorizeOsmTags(tags)
      expect(result, JSON.stringify(tags)).not.toBeNull()
      expect(KIND_LABELS[result!.kind], JSON.stringify(tags)).toBeTruthy()
    }
  })
})
