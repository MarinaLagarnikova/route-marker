import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CloudUpload, Flag, SportShoe } from 'lucide-react'
import { parseGpx } from '@/shared/lib/gpx'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

interface CarouselIcon {
  src: string
  // Natural dimensions from Figma at 100px height
  w: number
  h: number
  crop: { w: string; h: string; left: string; top: string }
}

const CAROUSEL_ICONS: CarouselIcon[] = [
  {
    src: '/icons/icon-location.png',
    w: 84, h: 120,
    crop: { h: '147.11%', left: '-49%', top: '-25.08%', w: '197.42%' },
  },
  {
    src: '/icons/icon-picture.png',
    w: 118, h: 120,
    crop: { h: '107.46%', left: '-2.91%', top: '-2.3%', w: '102.91%' },
  },
  {
    src: '/icons/icon-flash.png',
    w: 64, h: 120,
    crop: { h: '117.14%', left: '-52.5%', top: '-9.59%', w: '204.95%' },
  },
  {
    src: '/icons/icon-star.png',
    w: 121, h: 120,
    crop: { h: '208.86%', left: '-53.12%', top: '-56.96%', w: '206.25%' },
  },
]

const CAROUSEL_N = CAROUSEL_ICONS.length
const CAROUSEL_CYCLE = 4500 // ms per one icon width of travel
const CAROUSEL_SPACING = 148 // px between icon centers
const CAROUSEL_VISIBLE = 1.85 // |pos| threshold beyond which opacity = 0

function IconCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(undefined)
  const startRef = useRef<number>(undefined)

  useEffect(() => {
    function animate(time: number) {
      if (!startRef.current) startRef.current = time
      const t = ((time - startRef.current) / CAROUSEL_CYCLE) % CAROUSEL_N

      const container = containerRef.current
      if (container) {
        const kids = container.children
        for (let i = 0; i < CAROUSEL_N; i++) {
          // Continuous pos: how far icon i is from the "center spotlight"
          let pos = ((i - t + CAROUSEL_N) % CAROUSEL_N)
          if (pos > CAROUSEL_N / 2) pos -= CAROUSEL_N
          // pos ∈ (-n/2, n/2], negative = left of center

          const absPos = Math.abs(pos)
          const tx = pos * CAROUSEL_SPACING
          const opacity = absPos > CAROUSEL_VISIBLE ? 0 : Math.max(0, 1 - 0.45 * absPos)
          const zIndex = Math.round(20 - absPos * 5)

          const el = kids[i] as HTMLElement
          el.style.transform = `translateX(${tx}px)`
          el.style.opacity = String(opacity)
          el.style.zIndex = String(zIndex)
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 156,
        overflow: 'hidden',
        maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      {CAROUSEL_ICONS.map((icon, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: icon.w,
            height: icon.h,
            marginLeft: -icon.w / 2,
            marginTop: -icon.h / 2,
            willChange: 'transform, opacity',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <img
              src={icon.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                width: icon.crop.w,
                height: icon.crop.h,
                left: icon.crop.left,
                top: icon.crop.top,
                maxWidth: 'none',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function RouteCard({
  route,
  onClick,
  isActive,
}: {
  route: RouteState
  onClick: () => void
  isActive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4"
    >
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {isActive && (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" style={{ overflow: 'visible' }}>
              <circle className="dot-pulse-ring" cx="8" cy="8" r="8" fill="#FF7A29" />
              <circle cx="8" cy="8" r="3" fill="#FF7A29" />
            </svg>
          )}
          <p className="text-sm font-semibold text-zinc-900 truncate">{route.name}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <SportShoe className="w-4 h-4 text-zinc-900" />
            <span className="text-sm font-normal text-zinc-900">{(route.totalKm ?? 0).toFixed(0)} км</span>
          </div>
        </div>
        <p className="text-sm font-normal text-zinc-500">{fmtRouteSubtitle(route)}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" />
    </button>
  )
}

function fmtRouteSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  const coveredKm = checked.length ? (checked[checked.length - 1].distanceKm ?? 0) : 0
  const isCompleted = checked.length === r.checkpoints.length && r.checkpoints.length > 0

  if (isCompleted && checked.length > 0) {
    const firstTs = checked[0].checkedAt!
    const lastTs = checked[checked.length - 1].checkedAt!
    const firstDay = new Date(firstTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const lastDay = new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    const dateStr = firstDay === lastDay ? firstDay : `${firstDay} — ${lastDay}`
    return `${coveredKm.toFixed(1)} км пройдено · ${dateStr}`
  }

  return `${coveredKm.toFixed(1)} км пройдено`
}

interface AddTrackDrawerProps {
  routeName: string
  onNameChange: (name: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function AddTrackDrawer({ routeName, onNameChange, onConfirm, onCancel }: AddTrackDrawerProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onCancel} />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border border-zinc-200 rounded-t-2xl max-w-[560px] mx-auto transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-4">
          <div className="w-[100px] h-2 bg-zinc-100 rounded-full" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 p-4">
          {/* Name input */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-zinc-900">Название</p>
            <input
              type="text"
              value={routeName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Введите название"
              autoFocus
              className="w-full h-9 px-3 rounded-lg border border-zinc-200 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          {/* Confirm button */}
          <button
            onClick={onConfirm}
            disabled={!routeName.trim()}
            className="w-full h-11 bg-zinc-900 text-white text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:bg-zinc-800 transition-colors"
          >
            Добавить трек
          </button>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-full h-9 bg-white border border-zinc-200 text-sm font-medium text-zinc-900 rounded-xl active:bg-zinc-50 transition-colors"
          >
            Отменить
          </button>
        </div>
      </div>
    </>
  )
}

export function StartPage() {
  const navigate = useNavigate()
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const loadSaved = useRouteStore((s) => s.loadSaved)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsedGpx, setParsedGpx] = useState<{ data: GpxData; xml: string } | null>(null)
  const [routeName, setRouteName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [savedRoutes, setSavedRoutes] = useState<RouteState[]>([])

  useEffect(() => {
    const routes = storageKeys()
      .map((k) => storageGet<RouteState>(k))
      .filter((r): r is RouteState => r !== null)
    setSavedRoutes(routes)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const xml = ev.target?.result as string
      try {
        const data = parseGpx(xml)
        setParseError(null)
        handleParsed(data, xml)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Ошибка разбора файла')
      }
    }
    reader.readAsText(file)
  }

  function handleParsed(data: GpxData, xml: string) {
    const hash = hashString(xml)
    const existing = storageGet<RouteState>(hash)
    if (existing) {
      loadSaved(existing)
      navigate('/route')
      return
    }
    setParsedGpx({ data, xml })
    setRouteName(data.name)
  }

  function handleConfirm() {
    if (!parsedGpx || !routeName.trim()) return
    loadRoute(routeName.trim(), parsedGpx.data.trackPoints, parsedGpx.data.waypoints, parsedGpx.xml)
    navigate('/route')
  }

  function handleCancel() {
    setParsedGpx(null)
    setRouteName('')
  }

  function handleContinue(route: RouteState) {
    loadSaved(route)
    navigate('/route')
  }

  const completedRoutes = savedRoutes.filter(
    (r) => r.checkpoints.length > 0 && r.checkpoints.every((cp) => cp.checkedAt !== undefined)
  )
  const activeRoutes = savedRoutes.filter(
    (r) => !r.checkpoints.every((cp) => cp.checkedAt !== undefined)
  )

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="w-8 h-8 shrink-0" />
          <h1 className="text-[30px] font-semibold leading-[36px] text-zinc-900">{APP_NAME}</h1>
        </div>

        {/* Routes list or empty state */}
        {savedRoutes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-8 w-full">
              <IconCarousel />
              <div className="flex flex-col items-center gap-2">
                <p className="text-2xl font-semibold text-zinc-900 text-center">Загрузите первый трек</p>
                <p className="text-sm text-zinc-500 text-center">Отмечайте точки по мере прохождения — работает без GPS. Видно, сколько пройдено и когда будете на финише.</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-11 px-6 bg-zinc-900 text-white text-sm font-medium rounded-xl flex items-center gap-2.5 active:bg-zinc-800 transition-colors"
              >
                <CloudUpload className="w-4 h-4" />
                Загрузить GPX трек
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Active routes */}
            {activeRoutes.map((r) => (
              <RouteCard
                key={r.gpxHash}
                route={r}
                onClick={() => handleContinue(r)}
                isActive={r.checkpoints.some((cp) => cp.checkedAt !== undefined)}
              />
            ))}

            {/* Completed routes */}
            {completedRoutes.length > 0 && (
              <div className="flex flex-col gap-3 mt-5">
                <div className="flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-500">Завершённые</span>
                  <span className="text-sm font-medium text-zinc-500">{completedRoutes.length}</span>
                </div>
                {completedRoutes.map((r) => (
                  <RouteCard key={r.gpxHash} route={r} onClick={() => handleContinue(r)} />
                ))}
              </div>
            )}
          </div>
        )}

        {parseError && (
          <p className="text-sm text-red-600">{parseError}</p>
        )}
      </div>

      {/* Bottom sticky button — hidden in empty state (button is inline) */}
      {savedRoutes.length > 0 && (
        <div className="px-4 py-6 bg-white">
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-11 bg-zinc-900 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2.5 active:bg-zinc-800 transition-colors"
          >
            <CloudUpload className="w-4 h-4" />
            Загрузить GPX трек
          </button>
        </div>
      )}

      {/* Hidden file input for empty state button */}
      {savedRoutes.length === 0 && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Add track drawer */}
      {parsedGpx && (
        <AddTrackDrawer
          routeName={routeName}
          onNameChange={setRouteName}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
