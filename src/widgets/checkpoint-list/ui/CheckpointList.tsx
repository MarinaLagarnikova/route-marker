import { useRouteStore } from '@/entities/route'
import { getLastChecked } from '@/entities/checkpoint'
import { ResetButton } from '@/features/reset-progress'

function fmtTime(ts: number | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function CheckpointList() {
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)

  if (!route) return null

  const lastIdx = getLastChecked(route.checkpoints)

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-white sticky top-0 z-10">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Контрольные точки
        </p>
        <ResetButton />
      </div>
      {route.checkpoints.map((cp, i) => {
        const checked = cp.checkedAt !== undefined
        const isLast = i === lastIdx
        const isNext = i === lastIdx + 1

        return (
          <div
            key={cp.id}
            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 ${
              checked ? 'bg-red-50' : 'bg-white'
            }`}
          >
            <div
              className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                checked
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  checked ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}
              >
                {cp.name}
              </p>
              <p className="text-xs text-gray-400">
                {cp.distanceKm.toFixed(1)} км
                {cp.checkedAt ? ` · ${fmtTime(cp.checkedAt)}` : ''}
              </p>
            </div>
            {checked && isLast ? (
              <button
                onClick={() => unmarkLast()}
                className="min-w-[72px] min-h-[44px] rounded-lg text-sm font-medium bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors px-3"
              >
                Отменить
              </button>
            ) : checked ? (
              <div className="min-w-[72px]" />
            ) : isNext || lastIdx === -1 ? (
              <button
                onClick={() => markCheckpoint(i)}
                className="min-w-[72px] min-h-[44px] rounded-lg text-sm font-medium bg-red-600 text-white active:bg-red-700 transition-colors px-3"
              >
                Здесь
              </button>
            ) : (
              <div className="min-w-[72px]" />
            )}
          </div>
        )
      })}
    </div>
  )
}
