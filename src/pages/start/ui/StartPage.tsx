import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadGpx } from '@/features/upload-gpx'
import { useRouteStore, hashString } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import { APP_NAME } from '@/shared/config'
import type { GpxData } from '@/shared/lib/gpx'
import type { RouteState } from '@/entities/route'

function coveredKm(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  return checked.length ? checked[checked.length - 1].distanceKm.toFixed(1) : '0'
}

function totalKm(r: RouteState): string {
  return (r.checkpoints[r.checkpoints.length - 1]?.distanceKm ?? 0).toFixed(1)
}

export function StartPage() {
  const navigate = useNavigate()
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const loadSaved = useRouteStore((s) => s.loadSaved)

  const [parsedGpx, setParsedGpx] = useState<{ data: GpxData; xml: string } | null>(null)
  const [routeName, setRouteName] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<RouteState[]>([])

  useEffect(() => {
    const routes = storageKeys()
      .map((k) => storageGet<RouteState>(k))
      .filter((r): r is RouteState => r !== null)
    setSavedRoutes(routes)
  }, [])

  function handleParsed(data: GpxData, xml: string) {
    setParsedGpx({ data, xml })
    setRouteName(data.name)

    // If same GPX was saved, jump straight to route
    const hash = hashString(xml)
    const existing = storageGet<RouteState>(hash)
    if (existing) {
      loadSaved(existing)
      navigate('/route')
    }
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[560px] flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Отметь маршрут — пройди его</p>
        </div>

        {savedRoutes.length > 0 && (
          <div className="flex flex-col gap-2">
            {savedRoutes.map((r) => (
              <button
                key={r.gpxHash}
                onClick={() => handleContinue(r)}
                className="w-full text-left p-4 bg-white rounded-xl border border-gray-200 shadow-sm active:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Продолжить: {r.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Пройдено {coveredKm(r)} из {totalKm(r)} км ·{' '}
                  {r.checkpoints.filter((c) => c.checkedAt).length} из {r.checkpoints.length} точек
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
          <UploadGpx onParsed={handleParsed} />

          {parsedGpx && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Название маршрута</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Введите название"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-800 transition-colors"
          >
            Начать маршрут
          </button>
        </div>
      </div>
    </div>
  )
}
