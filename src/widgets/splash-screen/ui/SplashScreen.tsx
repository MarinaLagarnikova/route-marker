import { useEffect, useRef, useState } from 'react'
import {
  SPLASH_SLIDES,
  SPLASH_TITLE,
  SLIDE_DURATION_MS,
  SLIDE_TRANSITION_MS,
  MIN_DISPLAY_MS,
  MAX_DISPLAY_MS,
} from '../model/slides'

/** Вырезает середину, оставляя кольцо толщиной 4px. */
const RING_MASK = 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))'

interface Props {
  /** Данные приложения прогружены — экран может уходить. */
  ready: boolean
  /** Вызывается, когда экран отработал или пропущен тапом. */
  onDone: () => void
}

/**
 * Экран загрузки при первом запуске: заголовок и лоудер неподвижны,
 * карточка с иллюстрацией и подпись сменяют друг друга горизонтальным переездом.
 *
 * Живёт ровно столько, сколько идёт настоящая загрузка, — с нижней границей,
 * чтобы не мигнуть, и верхней, чтобы не запереть человека без связи.
 */
export function SplashScreen({ ready, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const startedAtRef = useRef(Date.now())
  // Свежий onDone без перезапуска таймеров на каждый ререндер родителя.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  function finish() {
    setLeaving(true)
    // Даём экрану раствориться, прежде чем размонтировать.
    window.setTimeout(() => onDoneRef.current(), SLIDE_TRANSITION_MS)
  }

  // Листание. Останавливается на последнем слайде: до него доходит только
  // по-настоящему медленная загрузка, и возвращаться в начало было бы странно.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timers = SPLASH_SLIDES.slice(1).map((_, i) =>
      window.setTimeout(() => setIndex(i + 1), SLIDE_DURATION_MS * (i + 1))
    )
    return () => timers.forEach(window.clearTimeout)
  }, [])

  // Уход: как только данные готовы и отработал минимум, либо по верхней границе.
  useEffect(() => {
    const elapsed = Date.now() - startedAtRef.current
    const delay = ready
      ? Math.max(0, MIN_DISPLAY_MS - elapsed)
      : Math.max(0, MAX_DISPLAY_MS - elapsed)

    const id = window.setTimeout(finish, delay)
    return () => window.clearTimeout(id)
  }, [ready])

  function skip() {
    finish()
  }

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#FF7A29] flex flex-col items-center justify-center px-4 transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={skip}
      role="status"
      aria-live="polite"
      aria-label={SPLASH_TITLE}
    >
      <div className="w-full max-w-[370px] flex flex-col items-center gap-6">
        <p className="text-xl font-semibold text-white text-center leading-normal">
          {SPLASH_TITLE}
        </p>

        {/* Окно карусели: шире карточки, чтобы соседние слайды уезжали за край. */}
        <div className="w-full overflow-hidden">
          <div
            className="flex transition-transform ease-out"
            style={{
              transform: `translateX(-${index * 100}%)`,
              transitionDuration: `${SLIDE_TRANSITION_MS}ms`,
            }}
          >
            {SPLASH_SLIDES.map((slide, i) => (
              <div key={slide.image} className="w-full shrink-0 flex flex-col items-center gap-6">
                <img
                  src={slide.image}
                  alt=""
                  // Первый слайд виден сразу, остальные не должны задерживать показ.
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  className="w-[320px] h-[400px] object-cover rounded-[40px] shadow-[8px_8px_22px_0px_rgba(255,255,255,0.25)]"
                />
                <p className="w-[290px] h-12 flex items-center justify-center text-xl font-semibold text-white text-center leading-normal">
                  {slide.caption}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Кольцо с затухающим хвостом, как в макете: прозрачность плавно падает
            по окружности. Конический градиент под маской-кольцом — так оно
            остаётся чётким на любой плотности экрана и не тянет картинку. */}
        <div
          className="size-12 rounded-full animate-spin"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
            WebkitMask: RING_MASK,
            mask: RING_MASK,
          }}
          aria-hidden
        />
      </div>
    </div>
  )
}
