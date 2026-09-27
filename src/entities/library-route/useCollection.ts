import { useEffect, useState } from 'react'
import { fetchCollection } from '@/shared/lib/library-api'
import { useLibraryStore } from './store'
import type { FavoriteEntry } from './store'
import type { LibraryCollection } from './model'

export interface CollectionQuery {
  collection: LibraryCollection | null
  loading: boolean
  error: string | null
}

/** «Хочу пройти» — не подборка с сервера, а срез по уже загруженным. */
function buildFavoritesCollection(
  favorites: FavoriteEntry[],
  cache: Record<string, LibraryCollection>
): LibraryCollection {
  const favoriteIds = new Set(favorites.map((f) => f.id))
  const all = Object.values(cache).flatMap((c) => c.routes)
  const routes = all.filter((r) => favoriteIds.has(r.id))
  return { id: 'favorites', name: 'Хочу пройти', totalRoutes: routes.length, routes }
}

/**
 * Подборка по id — из памяти, иначе с сервера.
 *
 * Живёт в entity, потому что её читают два экрана: список и карта. Карту можно
 * открыть прямой ссылкой, когда кэш ещё пуст, поэтому загрузка обязана быть
 * частью хука, а не оставаться на списке.
 */
export function useCollection(id: string | undefined): CollectionQuery {
  const favorites = useLibraryStore((s) => s.favorites)
  const collectionsCache = useLibraryStore((s) => s.collectionsCache)
  const setCollectionCache = useLibraryStore((s) => s.setCollectionCache)

  const [collection, setCollection] = useState<LibraryCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (id === 'favorites') {
      // Избранное собрано из разных регионов — дотягиваем те, которых нет в кэше.
      const regionIds = [...new Set(favorites.map((f) => f.regionId))]
      const missingIds = regionIds.filter((rid) => !collectionsCache[rid])
      if (missingIds.length === 0) {
        setCollection(buildFavoritesCollection(favorites, collectionsCache))
        setLoading(false)
        return
      }
      setLoading(true)
      Promise.all(
        missingIds.map((rid) => fetchCollection(rid).then((col) => setCollectionCache(rid, col)))
      )
        .catch(() => setError('Не удалось загрузить список'))
        .finally(() => setLoading(false))
      return
    }
    const cached = collectionsCache[id]
    if (cached) {
      setCollection(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchCollection(id)
      .then((col) => {
        setCollectionCache(id, col)
        setCollection(col)
      })
      .catch(() => setError('Не удалось загрузить подборку'))
      .finally(() => setLoading(false))
  }, [id])

  // Избранное меняется на ходу: тап по закладке должен отражаться сразу.
  useEffect(() => {
    if (id === 'favorites') {
      setCollection(buildFavoritesCollection(favorites, collectionsCache))
    }
  }, [id, favorites, collectionsCache])

  return { collection, loading, error }
}
