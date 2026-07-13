import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Ellipsis, Trash2, History, Share } from 'lucide-react'
import { useRouteStore, selectCoveredKm, selectTotalKm } from '@/entities/route'
import { HistoryDrawer } from '@/features/history'

type DrawerMode = 'menu' | 'delete' | null

export function RouteHeader() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)
  const clearRoute = useRouteStore((s) => s.clearRoute)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (drawerMode) {
      const id = requestAnimationFrame(() => setDrawerVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setDrawerVisible(false)
    }
  }, [drawerMode])

  function switchDrawer(next: DrawerMode) {
    setDrawerVisible(false)
    setTimeout(() => setDrawerMode(next), 300)
  }

  if (!route) return null

  const hasStarted = route.checkpoints.some((c) => c.checkedAt !== undefined)
  const historyDisabled = !hasStarted || (route.isCircular && route.circularPhase < 3)

  const totalKm = selectTotalKm(route)
  const coveredKm = selectCoveredKm(route)
  const progressPct = totalKm > 0 ? Math.min(100, (coveredKm / totalKm) * 100) : 0

  const checked = route.checkpoints.filter((c) => c.checkedAt !== undefined)
  const isCompleted = checked.length === route.checkpoints.length && route.checkpoints.length > 0
  const completedDateStr = isCompleted
    ? new Date(checked[checked.length - 1].checkedAt!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : null
  const subtitle = isCompleted
    ? `${coveredKm.toFixed(1)} км пройдено · ${completedDateStr}`
    : `${coveredKm.toFixed(1)} км пройдено`

  function handleDelete() {
    clearRoute()
    navigate('/', { replace: true })
  }

  async function handleShare() {
    if (!route?.gpxXml) return
    setDrawerMode(null)
    const file = new File([route.gpxXml], `${route.name}.gpx`, { type: 'application/gpx+xml' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: route?.name })
    } else {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = `${route?.name}.gpx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const drawerContent = drawerMode === 'menu' ? (
    <div className="flex flex-col p-4 gap-2">
      {route.gpxXml && (
        <button
          onClick={handleShare}
          className="w-full flex items-center py-3 active:bg-zinc-50 rounded transition-colors"
        >
          <div className="shrink-0 pr-2">
            <Share className="w-5 h-5 text-zinc-900" />
          </div>
          <span className="text-sm font-normal text-zinc-900">Поделиться треком</span>
        </button>
      )}
      <button
        onClick={() => switchDrawer('delete')}
        className="w-full flex items-center py-3 active:bg-zinc-50 rounded transition-colors"
      >
        <div className="shrink-0 pr-2">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <span className="text-sm font-normal text-red-600">Удалить</span>
      </button>
    </div>
  ) : drawerMode === 'delete' ? (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold text-zinc-900">
          Уверены, что хотите удалить трек?
        </h2>
        <p className="text-sm leading-5 text-zinc-500">
          Сам трек и прогресс по нему не сохранится, придётся загружать заново
        </p>
      </div>
      <button
        onClick={handleDelete}
        className="w-full h-9 bg-red-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 active:bg-red-700 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Удалить
      </button>
      <button
        onClick={() => setDrawerMode(null)}
        className="w-full h-9 bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg active:bg-zinc-50 transition-colors"
      >
        Отменить
      </button>
    </div>
  ) : null

  return (
    <>
      <div className="flex flex-col items-start w-full bg-white">
        {/* Top row */}
        <div className="px-4 pt-6 pb-6 w-full flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors"
            aria-label="На главную"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-900" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryOpen(true)}
              disabled={historyDisabled}
              className={`h-9 px-4 flex items-center gap-2.5 border rounded-lg transition-colors ${
                historyDisabled
                  ? 'border-zinc-100 bg-zinc-100 cursor-not-allowed'
                  : 'border-zinc-200 bg-white active:bg-zinc-50'
              }`}
            >
              <History className={`w-4 h-4 ${historyDisabled ? 'text-zinc-400' : 'text-zinc-700'}`} />
              <span className={`text-sm font-medium ${historyDisabled ? 'text-zinc-400' : 'text-zinc-700'}`}>История</span>
            </button>

            <button
              onClick={() => setDrawerMode('menu')}
              className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg bg-white active:bg-zinc-50 transition-colors"
              aria-label="Действия"
            >
              <Ellipsis className="w-4 h-4 text-zinc-700" />
            </button>
          </div>
        </div>

        {/* Route name + subtitle */}
        <div className="px-4 pb-3 flex flex-col gap-1 w-full">
          <h1 className="text-xl font-semibold text-zinc-900 truncate">{route.name}</h1>
          <p className="text-sm font-normal text-zinc-500">{subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2 w-full">
          <div className="h-1 w-full bg-zinc-200 rounded-lg overflow-hidden">
            <div
              className="h-full bg-zinc-900 rounded-lg transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <HistoryDrawer
          checkpoints={route.checkpoints}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Menu / Delete drawer */}
      {drawerMode && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerMode(null)} />
          <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-x border-zinc-200 rounded-t-[16px] max-w-[560px] mx-auto transition-transform duration-300 ease-out ${drawerVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-center pt-2">
              <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
            </div>
            {drawerContent}
          </div>
        </>
      )}
    </>
  )
}
