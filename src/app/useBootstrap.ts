import { useEffect, useState } from 'react'
import { fetchCollection } from '@/shared/lib/library-api'
import { COLLECTION_CARD_LIST, useLibraryStore } from '@/entities/library-route'

/** «Хочу пройти» собирается из подборок регионов, отдельной загрузки не требует. */
const REGION_IDS = COLLECTION_CARD_LIST.filter((c) => c.id !== 'favorites').map((c) => c.id)

/**
 * Прогревает подборки библиотеки, пока показывается экран загрузки.
 * Страница региона сначала смотрит в кэш, поэтому после прогрева она открывается
 * без ожидания.
 *
 * Возвращает признак готовности. Ошибки сети его не блокируют: приложение
 * рассчитано на работу без связи, и подборка при необходимости догрузится сама.
 */
export function useBootstrap(): boolean {
  const [ready, setReady] = useState(false)
  const setCollectionCache = useLibraryStore((s) => s.setCollectionCache)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled(
      REGION_IDS.map((id) => fetchCollection(id).then((collection) => ({ id, collection })))
    ).then((results) => {
      if (cancelled) return
      for (const result of results) {
        if (result.status === 'fulfilled') {
          setCollectionCache(result.value.id, result.value.collection)
        }
      }
      setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [setCollectionCache])

  return ready
}
