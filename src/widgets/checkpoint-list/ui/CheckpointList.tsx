import { Check } from 'lucide-react'
import { useRouteStore } from '@/entities/route'
import { getLastChecked } from '@/entities/checkpoint'

function fmtMeta(distanceKm: number, checkedAt: number | undefined): string {
  const km = `${distanceKm.toFixed(1)} км`
  if (!checkedAt) return km
  const time = new Date(checkedAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${km} · ${time}`
}

export function CheckpointList() {
  const route = useRouteStore((s) => s.route)
  const markCheckpoint = useRouteStore((s) => s.markCheckpoint)
  const unmarkLast = useRouteStore((s) => s.unmarkLast)

  if (!route) return null

  const lastIdx = getLastChecked(route.checkpoints)

  return (
    <div className="flex flex-col gap-3 px-4">
      {route.checkpoints.map((cp, i) => {
        const checked = cp.checkedAt !== undefined
        const isLast = i === lastIdx
        const isNext = i === lastIdx + 1 || (lastIdx === -1 && i === 0)

        return (
          <div
            key={cp.id}
            className="flex items-start gap-3 min-h-[46px]"
          >
            {/* Number badge */}
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 rounded-full border border-[#e5e5e5] flex items-center justify-center">
              <span className="text-[11px] font-medium text-[#0a0a0a] font-mono leading-4">
                {i + 1}
              </span>
            </div>

            {/* Name + meta */}
            <div
              className={`flex-1 min-w-0 flex flex-col gap-1.5 justify-center ${checked ? 'opacity-50' : ''}`}
            >
              <p className="text-sm font-medium leading-5 text-[#0a0a0a] truncate">{cp.name}</p>
              <p className="text-sm font-normal leading-5 text-[#737373]">
                {fmtMeta(cp.distanceKm, cp.checkedAt)}
              </p>
            </div>

            {/* Right action */}
            {checked ? (
              <button
                onClick={() => { if (isLast) unmarkLast() }}
                className={`w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center ${isLast ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={isLast ? 'Отменить' : undefined}
              >
                <Check className="w-[18px] h-[18px] text-[#0a0a0a]" strokeWidth={2} />
              </button>
            ) : isNext ? (
              <button
                onClick={() => markCheckpoint(i)}
                className="flex-shrink-0 h-9 w-[81px] border border-[#e5e5e5] rounded-[10px] bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] text-sm font-medium text-[#0a0a0a] active:bg-gray-50 transition-colors"
              >
                Здесь
              </button>
            ) : (
              <div className="w-[81px] flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
