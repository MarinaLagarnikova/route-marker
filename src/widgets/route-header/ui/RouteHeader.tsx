import { useNavigate } from 'react-router-dom'
import { useRouteStore, selectCoveredKm, selectTotalKm } from '@/entities/route'

export function RouteHeader() {
  const navigate = useNavigate()
  const route = useRouteStore((s) => s.route)

  if (!route) return null

  const totalKm = selectTotalKm(route)
  const coveredKm = selectCoveredKm(route)
  const progressPct = totalKm > 0 ? Math.min(100, (coveredKm / totalKm) * 100) : 0
  const totalPoints = route.checkpoints.length

  return (
    <div className="flex flex-col items-start w-full bg-white">
      {/* Back button */}
      <div className="px-4 pt-6 pb-2 w-full">
        <button
          onClick={() => navigate('/')}
          className="h-9 px-4 border border-[#e5e5e5] rounded-full text-sm font-medium text-[#0a0a0a] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] active:bg-gray-50 transition-colors"
        >
          Главная
        </button>
      </div>

      {/* Route name + subtitle */}
      <div className="px-4 pb-2 flex flex-col gap-0.5 w-full">
        <h1 className="text-lg font-medium leading-7 text-[#0a0a0a]">{route.name}</h1>
        <p className="text-sm font-normal leading-5 text-[#737373]">
          {totalKm.toFixed(0)} км · {totalPoints} {pluralPoints(totalPoints)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2 w-full">
        <div className="h-1.5 w-full bg-[#f5f5f5] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#171717] rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function pluralPoints(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'точек'
  if (mod10 === 1) return 'точка'
  if (mod10 >= 2 && mod10 <= 4) return 'точки'
  return 'точек'
}
