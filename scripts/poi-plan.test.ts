import { describe, it, expect } from 'vitest'
import { matchesTarget, skipReason } from './poi-plan'

describe('выбор маршрутов по цели прогона', () => {
  it('--all берёт каждый маршрут любой подборки', () => {
    expect(matchesTarget('--all', 'murmansk-region', 'tropa-sily')).toBe(true)
    expect(matchesTarget('--all', 'siberia', 'pik-lyubvi')).toBe(true)
  })

  // Раскатка идёт подборками: цель — имя папки региона
  it('цель-подборка берёт все её маршруты и ничего из соседней', () => {
    expect(matchesTarget('murmansk-region', 'murmansk-region', 'tropa-sily')).toBe(true)
    expect(matchesTarget('murmansk-region', 'murmansk-region', 'nittis')).toBe(true)
    expect(matchesTarget('murmansk-region', 'siberia', 'pik-lyubvi')).toBe(false)
  })

  it('цель-маршрут берёт ровно один', () => {
    expect(matchesTarget('tropa-sily', 'murmansk-region', 'tropa-sily')).toBe(true)
    expect(matchesTarget('tropa-sily', 'murmansk-region', 'nittis')).toBe(false)
  })
})

describe('докачка после обрыва', () => {
  it('маршрут без объектов забирается', () => {
    expect(skipReason({}, { force: false, localOnly: false })).toBeNull()
  })

  it('маршрут с добытыми объектами пропускается', () => {
    expect(skipReason({ pois: [{ id: 'node/1' }] }, { force: false, localOnly: false }))
      .toBe('объекты уже добыты')
  })

  // Ноль объектов — законный ответ Overpass, а не признак незавершённой работы.
  // Иначе пустые маршруты будут перезапрашиваться при каждой докачке
  it('пустой список объектов тоже считается добытым', () => {
    expect(skipReason({ pois: [] }, { force: false, localOnly: false }))
      .toBe('объекты уже добыты')
  })

  it('--force забирает заново', () => {
    expect(skipReason({ pois: [{ id: 'node/1' }] }, { force: true, localOnly: false })).toBeNull()
  })

  // --local не ходит в сеть: это пересчёт по запечённому, пропускать нечего
  it('--local пересчитывает и то, что уже добыто', () => {
    expect(skipReason({ pois: [{ id: 'node/1' }] }, { force: false, localOnly: true })).toBeNull()
  })

  // Иначе `--local --all` проставил бы пустой список всем нетронутым маршрутам
  // библиотеки, и сетевой прогон потом счёл бы их добытыми и обошёл стороной
  it('--local не трогает маршрут, которому нечего пересчитывать', () => {
    expect(skipReason({}, { force: false, localOnly: true })).toBe('нечего пересчитывать')
  })

  it('--local пересчитывает маршрут с фотографиями, даже без объектов', () => {
    expect(skipReason({ photos: [{ km: 1 }] }, { force: false, localOnly: true })).toBeNull()
  })
})
