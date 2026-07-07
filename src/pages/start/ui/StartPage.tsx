import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, SportShoe } from 'lucide-react'
import { parseGpx } from '@/shared/lib/gpx'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

function RouteCard({ route, onClick }: { route: RouteState; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-[#e5e5e5] rounded-[14px] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] py-6 px-6 flex items-start gap-1.5"
    >
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-[#0a0a0a] leading-5 truncate">{route.name}</p>
          <div className="flex items-center gap-1 shrink-0 text-[#737373]">
            <SportShoe className="w-3.5 h-3.5" />
            <span className="text-sm font-normal leading-5">{route.totalKm.toFixed(0)} км</span>
          </div>
        </div>
        <p className="text-sm font-normal text-[#737373] leading-5">{fmtRouteSubtitle(route)}</p>
      </div>
      <div className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-white flex-shrink-0">
        <ChevronRight className="w-4 h-4 text-[#0a0a0a]" />
      </div>
    </button>
  )
}

function fmtRouteSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  const coveredKm = checked.length ? checked[checked.length - 1].distanceKm : 0
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
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border border-[#e5e5e5] rounded-t-[10px] max-w-[560px] mx-auto transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-4">
          <div className="w-[100px] h-2 bg-[#f5f5f5] rounded-full" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 p-4">
          {/* Name input */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[#0a0a0a] leading-5">Название</p>
            <input
              type="text"
              value={routeName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Введите название"
              autoFocus
              className="w-full h-9 px-3 rounded-[8px] border border-[#e5e5e5] shadow-[0px_1px_2px_rgba(0,0,0,0.1)] text-base text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent"
            />
          </div>

          {/* Confirm button */}
          <button
            onClick={onConfirm}
            disabled={!routeName.trim()}
            className="w-full h-11 bg-[#171717] text-[#fafafa] text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed active:bg-[#2a2a2a] transition-colors"
          >
            Добавить трек
          </button>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-full h-9 bg-white border border-[#e5e5e5] text-sm font-medium text-[#0a0a0a] rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#f5f5f5] transition-colors"
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
    // reset input so same file can be picked again
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
      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <div className="px-4 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="w-8 h-8 shrink-0" />
            <h1 className="text-[30px] font-semibold leading-[36px] text-[#171717]">{APP_NAME}</h1>
          </div>
        </div>

        {/* Saved routes section */}
        <div className="flex flex-col gap-3 px-4 py-4">
          {savedRoutes.length === 0 && (
            <p className="text-sm text-[#737373] py-2">Загрузите GPX-трек, чтобы начать</p>
          )}

          {/* Active / in-progress routes */}
          {activeRoutes.map((r) => (
            <RouteCard key={r.gpxHash} route={r} onClick={() => handleContinue(r)} />
          ))}

          {/* Completed routes */}
          {completedRoutes.length > 0 && (
            <>
              <p className="text-sm font-medium text-[#0a0a0a] mt-8">Пройденные маршруты</p>
              {completedRoutes.map((r) => (
                <RouteCard key={r.gpxHash} route={r} onClick={() => handleContinue(r)} />
              ))}
            </>
          )}
        </div>

        {parseError && (
          <p className="px-4 pb-3 text-sm text-red-600">{parseError}</p>
        )}
      </div>

      {/* Bottom sticky button */}
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
          className="w-full h-11 bg-[#171717] text-[#fafafa] text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#2a2a2a] transition-colors"
        >
          Загрузить GPX трек
        </button>
      </div>

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
