import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAndroidFileOpened } from '@/shared/lib/android'
import { parseTrackFile } from '@/shared/lib/track-file'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet } from '@/shared/lib/storage'
import type { RouteState } from '@/entities/route'

/**
 * Трек, открытый из другого приложения («Поделиться → Вешка»).
 *
 * Живёт внутри роутера и без разметки: экран открытия может быть любым, а
 * переход нужен всегда. В браузере подписка ничего не делает.
 */
export function AndroidFileOpen() {
  const navigate = useNavigate()
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const loadSaved = useRouteStore((s) => s.loadSaved)

  useEffect(
    () =>
      onAndroidFileOpened(async (file) => {
        try {
          const { data, xml } = await parseTrackFile(file)

          // Тот же файл уже проходили — продолжаем, а не начинаем заново.
          const saved = storageGet<RouteState>(hashString(xml))
          if (saved) {
            loadSaved(saved)
          } else {
            loadRoute(data.name || 'Маршрут', data.trackPoints, data.waypoints, xml, data.trackSegments)
          }
          navigate('/route')
        } catch {
          // Формат не распознан — уводим на главную, там человек загрузит файл руками.
          navigate('/')
        }
      }),
    [navigate, loadRoute, loadSaved]
  )

  return null
}
