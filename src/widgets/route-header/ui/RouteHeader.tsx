import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Ellipsis, Trash2, Clock } from 'lucide-react'
import { useRouteStore, selectCoveredKm, selectTotalKm } from '@/entities/route'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { HistoryDrawer } from '@/features/history'

export function RouteHeader() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)
  const clearRoute = useRouteStore((s) => s.clearRoute)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (drawerOpen) {
      const id = requestAnimationFrame(() => setDrawerVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setDrawerVisible(false)
    }
  }, [drawerOpen])

  if (!route) return null

  const historyDisabled = route.isCircular && route.circularPhase < 3

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

  return (
    <>
      <div className="flex flex-col items-start w-full bg-white">
        {/* Top row: back button + ellipsis menu */}
        <div className="px-4 pt-6 pb-3 w-full flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#f5f5f5] transition-colors"
            aria-label="На главную"
          >
            <ChevronLeft className="w-4 h-4 text-[#0a0a0a]" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              disabled={historyDisabled}
              className={`h-9 px-3 flex items-center gap-1.5 border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] transition-colors ${
                historyDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'active:bg-[#f5f5f5]'
              }`}
            >
              <Clock className="w-4 h-4 text-[#0a0a0a]" />
              <span className="text-sm font-normal leading-5 text-[#0a0a0a]">История</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#f5f5f5] data-[state=open]:bg-[#f5f5f5] transition-colors"
                  aria-label="Действия"
                >
                  <Ellipsis className="w-4 h-4 text-[#0a0a0a]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] bg-white text-[#0a0a0a]">
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626] focus:bg-red-50 cursor-pointer"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Route name + subtitle */}
        <div className="px-4 pb-1.5 flex flex-col gap-1 w-full">
          <h1 className="text-xl font-semibold leading-7 text-[#0a0a0a] truncate">{route.name}</h1>
          <p className="text-sm font-normal leading-5 text-[#737373]">{subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2 w-full">
          <div className="h-1 w-full bg-[#f0f0f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#171717] rounded-full transition-all duration-300"
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

      {/* Delete drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border border-[#e5e5e5] rounded-t-[10px] max-w-[560px] mx-auto transition-transform duration-300 ease-out ${drawerVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-center pt-4 pb-0">
              <div className="w-[100px] h-2 bg-[#f5f5f5] rounded-full" />
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold leading-7 text-[#0a0a0a]">
                  Уверены, что хотите удалить трек?
                </h2>
                <p className="text-sm leading-5 text-[#737373]">
                  Сам трек и прогресс по нему не сохранится, придётся загружать заново
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="w-full h-9 bg-[#dc2626] text-white text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-red-700 transition-colors"
              >
                Удалить
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full h-9 bg-white border border-[#e5e5e5] text-[#0a0a0a] text-sm font-medium rounded-[10px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-[#f5f5f5] transition-colors"
              >
                Отменить
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
