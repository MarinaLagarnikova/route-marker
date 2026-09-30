import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { RoutePhoto } from '../model'

const SWIPE_THRESHOLD_PX = 50

interface Props {
  photos: RoutePhoto[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

/**
 * Stories-style viewer: segment bar on top, tap the edges or swipe to move
 * between shots. Открывается и из шторки маршрута, и с карты — по тапу
 * на фотокарточку слоя «Интересное».
 */
export function PhotoStories({ photos, index, onIndexChange, onClose }: Props) {
  const touchStartX = useRef<number | null>(null)
  const photo = photos[index]

  function go(delta: number) {
    const next = index + delta
    // Past the last shot the story ends, as it would in a stories player.
    if (next < 0) return
    if (next >= photos.length) return onClose()
    onIndexChange(next)
  }

  // Opened from a drawer that already scrolls; lock the page behind it.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографий"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null) return
        const delta = e.changedTouches[0].clientX - start
        if (Math.abs(delta) > SWIPE_THRESHOLD_PX) go(delta < 0 ? 1 : -1)
      }}
    >
      {/* Segments */}
      <div className="flex gap-1 px-3 pt-3 shrink-0">
        {photos.map((p, i) => (
          <div
            key={p.src}
            className={`h-0.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <span className="text-xs text-white/60">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <img src={photo.src} alt={photo.caption ?? ''} className="max-w-full max-h-full object-contain" />

        {/* Tap zones sit above the image; the left one is narrower, as in stories players. */}
        <button
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => go(-1)}
          aria-label="Предыдущее фото"
        />
        <button
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => go(1)}
          aria-label="Следующее фото"
        />
      </div>

      {(photo.caption || photo.km !== undefined) && (
        <div className="px-4 pt-3 pb-6 shrink-0">
          {photo.caption && <p className="text-sm text-white leading-5">{photo.caption}</p>}
          {photo.km !== undefined && (
            <p className="text-xs text-white/50 leading-5 mt-0.5">
              {photo.km.toFixed(1)} км маршрута
            </p>
          )}
        </div>
      )}
    </div>
  )
}
