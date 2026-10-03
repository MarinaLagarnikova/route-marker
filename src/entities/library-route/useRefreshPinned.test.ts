import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLibraryStore } from './store'
import { useRefreshPinnedRoute } from './useRefreshPinned'
import type { LibraryRoute } from './model'

const PINNED = {
  id: 'listvyanka-bolshoe-goloustnoe',
  name: 'п. Листвянка — п. Большое Голоустное',
  region: { id: 'siberia', name: 'Сибирь' },
} as unknown as LibraryRoute

function collectionWith(pois: unknown[]) {
  return {
    id: 'siberia',
    routes: [{ ...PINNED, pois }],
  }
}

describe('обновление закреплённого снимка', () => {
  beforeEach(() => {
    localStorage.clear()
    useLibraryStore.setState({ pinnedRoutes: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('подтягивает объекты, появившиеся в подборке после закрепления', async () => {
    useLibraryStore.getState().pinRoute(PINNED)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => collectionWith([{ id: 'node/1', category: 'camp' }]),
    }))

    renderHook(() => useRefreshPinnedRoute(PINNED.id))

    await waitFor(() => {
      expect(useLibraryStore.getState().pinnedRoutes[0].pois).toHaveLength(1)
    })
  })

  // Приложение рассчитано на отсутствие сети: обновление — это удача, а не
  // условие работы. Без сети остаётся прежний снимок и никаких ошибок
  it('без сети оставляет прежний снимок и молчит', async () => {
    useLibraryStore.getState().pinRoute({ ...PINNED, pois: [] } as unknown as LibraryRoute)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    renderHook(() => useRefreshPinnedRoute(PINNED.id))

    await new Promise((r) => setTimeout(r, 10))
    expect(useLibraryStore.getState().pinnedRoutes).toHaveLength(1)
    expect(useLibraryStore.getState().pinnedRoutes[0].pois).toEqual([])
  })

  it('не ходит в сеть, если маршрут не закреплён', () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    renderHook(() => useRefreshPinnedRoute('nothing-here'))

    expect(spy).not.toHaveBeenCalled()
  })
})
