import { X } from 'lucide-react'
import { CATEGORY_LABELS, poiLabel, type RoutePoi } from '@/shared/lib/poi'

interface Props {
  poi: RoutePoi
  onClose: () => void
}

/**
 * Компактная плашка об объекте слоя. Полноэкранный показ роднику не нужен —
 * достаточно того, что это и на каком километре.
 */
export function PoiSheet({ poi, onClose }: Props) {
  const { title, subtitle } = poiLabel(poi)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_2px_16px_rgba(0,0,0,0.18)]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 leading-5 truncate">{title}</p>
          <p className="text-xs text-zinc-500 leading-5">{subtitle}</p>
          <p className="text-xs text-zinc-400 leading-5">{CATEGORY_LABELS[poi.category]}</p>
        </div>
        <button
          onClick={onClose}
          className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full active:bg-zinc-100 transition-colors shrink-0"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4 text-zinc-600" />
        </button>
      </div>
    </div>
  )
}
