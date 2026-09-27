import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useSheetDrag } from '@/shared/lib/sheet-drag'

interface DrawerProps {
  onClose: () => void
  children: React.ReactNode
}

export function Drawer({ onClose, children }: DrawerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const drag = useSheetDrag(handleClose)

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 ${drag.dragging ? '' : 'transition-opacity duration-300'} ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={drag.offset ? { opacity: Math.max(0, 1 - drag.offset / 400) } : undefined}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-[560px] mx-auto flex flex-col ease-out pointer-events-none ${drag.dragging ? '' : 'transition-transform duration-300'} ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85dvh', ...(drag.offset ? { transform: `translateY(${drag.offset}px)` } : {}) }}
      >
        {/* Close button */}
        <div className="flex justify-end px-4 pb-1.5 pointer-events-none">
          <button onClick={handleClose} className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors" aria-label="Закрыть">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sheet */}
        <div
          ref={drag.sheetRef}
          className="bg-white border-t border-x border-zinc-200 rounded-t-[16px] flex flex-col overflow-hidden min-h-0 flex-1 pointer-events-auto"
        >
          <div className="flex items-center justify-center pt-2 shrink-0">
            <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
          </div>
          <div ref={drag.scrollRef} className="overflow-y-auto overscroll-contain min-h-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
