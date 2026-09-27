import { useEffect, useRef, useState } from 'react'
import { DRAG_START_PX, shouldCloseSheet } from './shouldCloseSheet'

export interface SheetDrag {
  /** Насколько шторка утащена вниз, px. 0 — на месте. */
  offset: number
  /** Палец сейчас ведёт шторку: на время жеста анимацию надо выключить. */
  dragging: boolean
  /** Вешается на лист — жест ловится здесь. */
  sheetRef: React.RefObject<HTMLDivElement | null>
  /** Вешается на прокручиваемую область внутри листа, если она есть. */
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Свайп вниз по шторке, закрывающий её.
 *
 * Жест и прокрутка контента делят один палец, поэтому тянуть разрешаем лишь
 * тогда, когда содержимое уже прокручено в самый верх, — иначе смах вниз
 * посреди длинного описания закрывал бы шторку вместо прокрутки.
 *
 * Слушатели ставятся напрямую, а не через пропсы React: touchmove нужен
 * непассивным, чтобы во время перетаскивания подавить прокрутку под пальцем.
 */
export function useSheetDrag(onClose: () => void): SheetDrag {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Закрытие пересоздаётся на каждый рендер, а переподписка посреди жеста
  // сбросила бы его состояние — поэтому держим в ref.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return

    let startY = 0
    let startTime = 0
    let active = false  // жест признан нашим
    let decided = false // направление уже определено

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      startTime = e.timeStamp
      active = false
      decided = false
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const dy = e.touches[0].clientY - startY

      if (!decided) {
        if (Math.abs(dy) < DRAG_START_PX) return
        decided = true
        const atTop = !scrollRef.current || scrollRef.current.scrollTop <= 0
        active = dy > 0 && atTop
        if (!active) return
        // Отсчёт с момента захвата, иначе шторка прыгнет на первые пиксели.
        startY = e.touches[0].clientY
        startTime = e.timeStamp
        setDragging(true)
        return
      }

      if (!active) return
      e.preventDefault()
      setOffset(Math.max(0, e.touches[0].clientY - startY))
    }

    function onTouchEnd(e: TouchEvent) {
      if (!active) return
      active = false
      decided = false
      setDragging(false)
      const dy = e.changedTouches[0].clientY - startY
      // Сбрасываем всегда: при закрытии шторка доезжает вниз штатной анимацией.
      setOffset(0)
      if (shouldCloseSheet(dy, e.timeStamp - startTime)) onCloseRef.current()
    }

    sheet.addEventListener('touchstart', onTouchStart, { passive: true })
    sheet.addEventListener('touchmove', onTouchMove, { passive: false })
    sheet.addEventListener('touchend', onTouchEnd, { passive: true })
    sheet.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      sheet.removeEventListener('touchstart', onTouchStart)
      sheet.removeEventListener('touchmove', onTouchMove)
      sheet.removeEventListener('touchend', onTouchEnd)
      sheet.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return { offset, dragging, sheetRef, scrollRef }
}
