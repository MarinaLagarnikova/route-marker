import { describe, it, expect } from 'vitest'
import { COLLECTION_CARD_LIST } from './data'

/**
 * The route count lives in two places: the card on the home screen (data.ts, needed
 * synchronously on first paint) and totalRoutes in each collection.json. Adding a route
 * touches only the latter, so they drift silently — the card just shows a stale number.
 * These fixtures are imported through Vite, which resolves JSON without extra config.
 */
const collections = import.meta.glob<{ id: string; totalRoutes: number; routes: unknown[] }>(
  '/public/tracks/*/collection.json',
  { eager: true, import: 'default' }
)

describe('COLLECTION_CARD_LIST', () => {
  const byId = Object.values(collections)

  it('finds every collection file', () => {
    expect(byId.length).toBeGreaterThan(0)
  })

  it.each(Object.values(collections))(
    'card count for $id matches the collection',
    (collection) => {
      const card = COLLECTION_CARD_LIST.find((c) => c.id === collection.id)

      expect(card, `нет карточки для подборки ${collection.id}`).toBeDefined()
      expect(card!.count).toBe(collection.routes.length)
      expect(collection.totalRoutes).toBe(collection.routes.length)
    }
  )
})
