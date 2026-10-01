import { X } from 'lucide-react'
import { CATEGORY_LABELS, poiLabel, type RoutePoi } from '@/shared/lib/poi'
import { POI_GLYPHS, POI_ACCENT } from '@/shared/lib/map-adapter'

interface Props {
  poi: RoutePoi
  onClose: () => void
}

/**
 * Компактная плашка об объекте слоя: что это и к какой группе относится.
 * Полноэкранный показ роднику не нужен.
 *
 * Километраж не показываем: объект стоит в стороне от трека, и его «километр»
 * — это проекция на ближайшую точку, число правдоподобное, но не то, которое
 * человек пройдёт ногами.
 */
export function PoiSheet({ poi, onClose }: Props) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="w-[70%] mx-auto flex items-center gap-2 rounded-2xl bg-white px-2.5 py-2.5 shadow-[0_2px_16px_rgba(0,0,0,0.18)]">
        {/* Тот же значок и тот же оранжевый, что у метки на карте */}
        <div
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center"
          style={{ background: POI_ACCENT }}
          aria-hidden
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="#ffffff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: POI_GLYPHS[poi.category] }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 leading-5 truncate">{poiLabel(poi)}</p>
          <p className="text-xs text-zinc-500 leading-5 truncate">{CATEGORY_LABELS[poi.category]}</p>
        </div>

        {/* Крестик повторяет значки зума: та же кнопка 36 px, тот же глиф в
            14 px и тот же цвет rgb(68,73,82) — он зашит в стили MapLibre */}
        <button
          onClick={onClose}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full active:bg-zinc-100 transition-colors"
          aria-label="Закрыть"
        >
          {/* Штрих толще стандартного: у MapLibre «плюс» залит на 2.1 px,
              а lucide при 14 px даёт 1.17 — крестик смотрелся бы бледнее */}
          <X className="w-3.5 h-3.5 text-[#444952]" strokeWidth={2.75} />
        </button>
      </div>
    </div>
  )
}
