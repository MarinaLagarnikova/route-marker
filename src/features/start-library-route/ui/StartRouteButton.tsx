import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useLibraryStore } from '@/entities/library-route'
import type { LibraryRoute } from '@/entities/library-route'
import { startLibraryRoute } from '../lib/startLibraryRoute'

const TEXTS = {
  start: 'Начать маршрут',
  resume: 'Продолжить маршрут',
  loading: 'Открываем маршрут…',
} as const

function Spinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="animate-spin shrink-0"
      aria-hidden
    >
      <path
        d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8Z"
        fill="white"
        fillOpacity="0.3"
      />
      <path
        d="M8.00391 16C5.88217 16 3.84734 15.1571 2.34705 13.6569C0.846761 12.1566 0.00390641 10.1217 0.00390625 8C0.00390609 5.87827 0.846761 3.84344 2.34705 2.34315C3.84734 0.842855 5.88217 3.20373e-07 8.00391 0L8.00391 2C6.41261 2 4.88648 2.63214 3.76127 3.75736C2.63605 4.88258 2.00391 6.4087 2.00391 8C2.00391 9.5913 2.63605 11.1174 3.76127 12.2426C4.88648 13.3679 6.41261 14 8.00391 14V16Z"
        fill="white"
      />
    </svg>
  )
}

/**
 * Главное действие карточки маршрута: открыть его и начать проходить.
 *
 * Маршрут попадает на главную как побочный эффект старта — отдельной кнопки
 * «добавить» нет. Убрать его оттуда можно в меню шапки самого маршрута.
 */
export function StartRouteButton({ route }: { route: LibraryRoute }) {
  const navigate = useNavigate()
  // Закреплённость решает только надпись на кнопке: «Продолжить» или «Начать».
  const isPinned = useLibraryStore((s) => s.isPinned(route.id))
  const pinRoute = useLibraryStore((s) => s.pinRoute)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      // Зовём всегда, в том числе для уже закреплённого: pinRoute освежает
      // снимок данными из подборки. Снимок, сделанный до раскатки слоя, иначе
      // остался бы без объектов навсегда.
      pinRoute(route)
      if (await startLibraryRoute(route)) navigate('/route')
      else setLoading(false)
    } catch {
      // Трек не скачался — остаёмся на месте, человек повторит тап.
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex-1 h-9 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 transition-colors ${
        loading ? 'bg-zinc-500' : 'bg-zinc-900 active:bg-zinc-800'
      }`}
    >
      {loading ? (
        <>
          <Spinner />
          {TEXTS.loading}
        </>
      ) : (
        <>
          <Play className="w-4 h-4 shrink-0" fill="currentColor" />
          {isPinned ? TEXTS.resume : TEXTS.start}
        </>
      )}
    </button>
  )
}
