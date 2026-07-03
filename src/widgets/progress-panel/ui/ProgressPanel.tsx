import { useRouteStore } from '@/entities/route'
import {
  selectCoveredKm,
  selectRemainingKm,
  selectTotalKm,
  selectFinishForecast,
} from '@/entities/route'

function fmtKm(km: number): string {
  return km.toFixed(1)
}

function fmtTime(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function ProgressPanel() {
  const route = useRouteStore((s) => s.route)
  if (!route) return null

  const covered = selectCoveredKm(route)
  const remaining = selectRemainingKm(route)
  const total = selectTotalKm(route)
  const forecast = selectFinishForecast(route)

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 text-sm">
      <div className="text-center">
        <p className="text-xs text-gray-400">Пройдено</p>
        <p className="font-semibold text-gray-900">{fmtKm(covered)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Осталось</p>
        <p className="font-semibold text-gray-900">{fmtKm(remaining)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Всего</p>
        <p className="font-semibold text-gray-900">{fmtKm(total)} км</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400">Финиш ~</p>
        <p className="font-semibold text-gray-900">{fmtTime(forecast)}</p>
      </div>
    </div>
  )
}
