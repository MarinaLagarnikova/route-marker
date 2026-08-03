import { create } from 'zustand'
import { storageGet, storageSet } from '@/shared/lib/storage'
import type { LibraryCollection, LibraryRoute } from './model'

const FAVORITES_KEY = 'library_favorites'
const PINNED_KEY = 'library_pinned'

// Store without full track data to keep localStorage lean
type PinnedRoute = Omit<LibraryRoute, 'track'>

interface LibraryStore {
  favorites: string[]
  toggleFavorite(routeId: string): void
  isFavorite(routeId: string): boolean

  pinnedRoutes: PinnedRoute[]
  pinRoute(route: LibraryRoute): void
  unpinRoute(routeId: string): void
  isPinned(routeId: string): boolean

  // In-memory cache of loaded collections (not persisted to localStorage)
  collectionsCache: Record<string, LibraryCollection>
  setCollectionCache(id: string, collection: LibraryCollection): void
  getCollectionCache(id: string): LibraryCollection | undefined
}

function loadFavorites(): string[] {
  return storageGet<string[]>(FAVORITES_KEY) ?? []
}

function loadPinned(): PinnedRoute[] {
  return storageGet<PinnedRoute[]>(PINNED_KEY) ?? []
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

  pinnedRoutes: loadPinned(),

  pinRoute(route: LibraryRoute) {
    const current = get().pinnedRoutes
    if (current.some((r) => r.id === route.id)) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { track: _track, ...rest } = route
    const next = [rest, ...current]
    storageSet(PINNED_KEY, next)
    set({ pinnedRoutes: next })
  },

  unpinRoute(routeId: string) {
    const next = get().pinnedRoutes.filter((r) => r.id !== routeId)
    storageSet(PINNED_KEY, next)
    set({ pinnedRoutes: next })
  },

  isPinned(routeId: string) {
    return get().pinnedRoutes.some((r) => r.id === routeId)
  },

  collectionsCache: {},

  setCollectionCache(id: string, collection: LibraryCollection) {
    set((s) => ({ collectionsCache: { ...s.collectionsCache, [id]: collection } }))
  },

  getCollectionCache(id: string) {
    return get().collectionsCache[id]
  },
}))
