import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { parseGpx } from '@/shared/lib/gpx'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

function fmtRouteSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  const coveredKm = checked.length ? checked[checked.length - 1].distanceKm : 0
  const totalKm = r.checkpoints[r.checkpoints.length - 1]?.distanceKm ?? 0

  const lastTs = checked.length ? checked[checked.length - 1].checkedAt! : null
  const dateStr = lastTs
    ? new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : null

  const parts = [
    dateStr,
    `${coveredKm.toFixed(1)} из ${totalKm.toFixed(1)} км`,
    `${checked.length} из ${r.checkpoints.length} точек`,
  ].filter(Boolean)

  return parts.join(' · ')
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

  function handleStart() {
    if (!parsedGpx || !routeName.trim()) return
    loadRoute(routeName.trim(), parsedGpx.data.trackPoints, parsedGpx.data.waypoints, parsedGpx.xml)
    navigate('/route')
  }

  function handleContinue(route: RouteState) {
    loadSaved(route)
    navigate('/route')
  }

  const canStart = parsedGpx !== null && routeName.trim().length > 0

  return (
    <div className="h-screen flex flex-col max-w-[560px] mx-auto bg-white">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <div className="px-4 pt-6 pb-0">
          <h1 className="text-[30px] font-bold leading-[36px] text-[#0a0a0a]">{APP_NAME}</h1>
        </div>

        {/* Saved routes section */}
        <div className="flex flex-col gap-3 px-4 py-4">
          {savedRoutes.length > 0 && (
            <p className="text-sm font-medium text-[#0a0a0a]">Пройденные маршруты</p>
          )}

          {savedRoutes.map((r) => (
            <button
              key={r.gpxHash}
              onClick={() => handleContinue(r)}
              className="w-full text-left bg-white border border-[#e5e5e5] rounded-[14px] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] py-6 px-6 flex items-start gap-1.5"
            >
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <p className="text-sm font-semibold text-[#0a0a0a] leading-5 truncate">{r.name}</p>
                <p className="text-sm font-normal text-[#737373] leading-5">{fmtRouteSubtitle(r)}</p>
              </div>
              <div className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-white flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-[#0a0a0a]" />
              </div>
            </button>
          ))}

          {savedRoutes.length === 0 && (
            <p className="text-sm text-[#737373] py-2">Загрузите GPX-трек, чтобы начать</p>
          )}
        </div>

        {/* Name input — shown after file selected */}
        {parsedGpx && (
          <div className="px-4 pb-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#0a0a0a]">Название маршрута</p>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Введите название"
              className="w-full px-4 py-2.5 rounded-[10px] border border-[#e5e5e5] text-sm text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent"
            />
          </div>
        )}

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
        {parsedGpx ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full h-11 bg-[#171717] text-[#fafafa] text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed active:bg-[#2a2a2a] transition-colors"
          >
            Начать маршрут
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-11 bg-[#171717] text-[#fafafa] text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#2a2a2a] transition-colors"
          >
            Загрузить GPX трек
          </button>
        )}
      </div>
    </div>
  )
}
