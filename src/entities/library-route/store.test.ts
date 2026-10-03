import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from './store'
import type { LibraryRoute } from './model'

function route(overrides: Partial<LibraryRoute> = {}): LibraryRoute {
  return {
    id: 'listvyanka-bolshoe-goloustnoe',
    name: 'п. Листвянка — п. Большое Голоустное',
    gpx: 'listvyanka.gpx',
    ...overrides,
  } as LibraryRoute
}

describe('закреплённые маршруты', () => {
  beforeEach(() => {
    localStorage.clear()
    useLibraryStore.setState({ pinnedRoutes: [] })
  })

  it('закрепляет маршрут', () => {
    useLibraryStore.getState().pinRoute(route())
    expect(useLibraryStore.getState().pinnedRoutes).toHaveLength(1)
  })

  it('не плодит дублей при повторном закреплении', () => {
    useLibraryStore.getState().pinRoute(route())
    useLibraryStore.getState().pinRoute(route())
    expect(useLibraryStore.getState().pinnedRoutes).toHaveLength(1)
  })

  // Снимок закреплённого маршрута живёт в localStorage месяцами, а данные
  // подборки под ним меняются: объекты добываются и перетряхиваются. Без
  // обновления человек, закрепивший маршрут до раскатки слоя, не увидит ни
  // объектов, ни кнопки слоя — и никакая перезагрузка это не исправит
  it('обновляет снимок, если маршрут уже закреплён', () => {
    useLibraryStore.getState().pinRoute(route({ pois: [] }))
    useLibraryStore.getState().pinRoute(route({
      pois: [{ id: 'node/1', category: 'camp', kind: 'camp_site', lat: 1, lon: 2, km: 0.5 }],
    }))

    const pinned = useLibraryStore.getState().pinnedRoutes
    expect(pinned).toHaveLength(1)
    expect(pinned[0].pois).toHaveLength(1)
  })

  it('обновление не двигает маршрут в начало списка', () => {
    useLibraryStore.getState().pinRoute(route({ id: 'first' }))
    useLibraryStore.getState().pinRoute(route({ id: 'second' }))
    useLibraryStore.getState().pinRoute(route({ id: 'first', name: 'Переименованный' }))

    const ids = useLibraryStore.getState().pinnedRoutes.map((r) => r.id)
    expect(ids).toEqual(['second', 'first'])
  })

  it('обновлённый снимок переживает перезагрузку', () => {
    useLibraryStore.getState().pinRoute(route({ pois: [] }))
    useLibraryStore.getState().pinRoute(route({
      pois: [{ id: 'node/1', category: 'water', kind: 'spring', lat: 1, lon: 2, km: 0.5 }],
    }))

    const saved = JSON.parse(localStorage.getItem('veshka_library_pinned') ?? '[]')
    expect(saved[0].pois).toHaveLength(1)
  })
})
