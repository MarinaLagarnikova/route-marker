import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Flag, SportShoe } from 'lucide-react'
import { useRouteStore } from '@/entities/route'
import { storageGet, storageKeys } from '@/shared/lib/storage'
import type { RouteState } from '@/entities/route'

function fmtCompletedSubtitle(r: RouteState): string {
  const checked = r.checkpoints.filter((c) => c.checkedAt)
  if (checked.length === 0) return ''
  const firstTs = checked[0].checkedAt!
  const lastTs = checked[checked.length - 1].checkedAt!
  const date = new Date(lastTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const durationMs = lastTs - firstTs
  const hours = Math.floor(durationMs / 3600000)
  const minutes = Math.floor((durationMs % 3600000) / 60000)
  const dur = hours === 0 ? `${minutes} мин` : minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`
  return `${date} · ${dur}`
}

export function CompletedPage() {
  const navigate = useNavigate()
  const loadSaved = useRouteStore((s) => s.loadSaved)
  const [routes, setRoutes] = useState<RouteState[]>([])

  useEffect(() => {
    const allKeys = storageKeys()
    const routeKeys = allKeys.filter(
      (k) => !k.startsWith('multi_') && !/^.+_s\d+$/.test(k)
    )
    const completed = routeKeys
      .map((k) => storageGet<RouteState>(k))
      .filter(
        (r): r is RouteState =>
          r !== null &&
          typeof r.gpxHash === 'string' &&
          r.checkpoints.length > 0 &&
          r.checkpoints.every((cp) => cp.checkedAt !== undefined)
      )
    setRoutes(completed)
  }, [])

  function handleOpen(route: RouteState) {
    loadSaved(route)
    navigate('/route')
  }

  return (
    <div className="h-dvh flex flex-col max-w-[560px] mx-auto bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white">
          <div className="px-4 pt-6 pb-6 w-full flex items-center">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors"
              aria-label="На главную"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-900" />
            </button>
          </div>
          <div className="px-4 flex items-center gap-2 w-full">
            <Flag className="w-4 h-4 text-zinc-900 shrink-0" />
            <h1 className="text-xl font-semibold text-zinc-900">Завершённые</h1>
            <span className="text-xl font-semibold text-zinc-400">{routes.length}</span>
          </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-3 px-4 mt-8">
          {routes.map((r) => (
            <button
              key={r.gpxHash}
              onClick={() => handleOpen(r)}
              className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-4 active:bg-zinc-50 transition-colors"
            >
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{r.name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SportShoe className="w-4 h-4 text-zinc-900" />
                    <span className="text-sm font-normal text-zinc-900">{(r.totalKm ?? 0).toFixed(0)} км</span>
                  </div>
                </div>
                <p className="text-sm font-normal text-zinc-500">{fmtCompletedSubtitle(r)}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mb-8" />
      </div>
    </div>
  )
}
