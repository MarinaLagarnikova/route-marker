import { create } from 'zustand'
import { storageGet, storageSet } from '@/shared/lib/storage'
import type { LibraryCollection } from './model'

const FAVORITES_KEY = 'library_favorites'

interface LibraryStore {
  favorites: string[]
  toggleFavorite(routeId: string): void
  isFavorite(routeId: string): boolean

  // In-memory cache of loaded collections (not persisted to localStorage)
  collectionsCache: Record<string, LibraryCollection>
  setCollectionCache(id: string, collection: LibraryCollection): void
  getCollectionCache(id: string): LibraryCollection | undefined
}

function loadFavorites(): string[] {
  return storageGet<string[]>(FAVORITES_KEY) ?? []
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  favorites: loadFavorites(),

  toggleFavorite(routeId: string) {
    const current = get().favorites
    const next = current.includes(routeId)
      ? current.filter((id) => id !== routeId)
      : [...current, routeId]
    storageSet(FAVORITES_KEY, next)
    set({ favorites: next })
  },

  isFavorite(routeId: string) {
    return get().favorites.includes(routeId)
  },

  collectionsCache: {},

  setCollectionCache(id: string, collection: LibraryCollection) {
    set((s) => ({ collectionsCache: { ...s.collectionsCache, [id]: collection } }))
  },

  getCollectionCache(id: string) {
    return get().collectionsCache[id]
  },
}))
