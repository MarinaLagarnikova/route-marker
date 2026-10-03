import { useEffect } from 'react'
import { useLibraryStore } from './store'
import type { LibraryCollection } from './model'

/**
 * Освежает снимок закреплённого маршрута данными из подборки.
 *
 * Снимок лежит в localStorage и переживает месяцы, а подборка под ним меняется:
 * объекты слоя «Интересное» добываются подборка за подборкой, категории
 * перетряхиваются. Маршрут, закреплённый до раскатки слоя, иначе навсегда
 * остался бы без объектов — со стартового экрана он открывается напрямую, минуя
 * кнопку «Начать маршрут», и обновить снимок было некому.
 *
 * Обновление — удача, а не условие работы: приложение рассчитано на отсутствие
 * сети, поэтому любая осечка оставляет прежний снимок и проходит молча.
 */
export function useRefreshPinnedRoute(routeId: string | undefined): void {
  const pinned = useLibraryStore((s) =>
    routeId ? s.pinnedRoutes.find((r) => r.id === routeId) : undefined,
  )
  const regionId = pinned?.region?.id
  const pinRoute = useLibraryStore((s) => s.pinRoute)

  useEffect(() => {
    if (!routeId || !regionId) return
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch(`/tracks/${regionId}/collection.json`)
        if (!res.ok) return
        const collection = (await res.json()) as LibraryCollection
        const fresh = collection.routes.find((r) => r.id === routeId)
        if (fresh && !cancelled) pinRoute(fresh)
      } catch {
        // Нет сети — работаем с тем, что уже закреплено.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [routeId, regionId, pinRoute])
}
