import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

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

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-[560px] mx-auto flex flex-col transition-transform duration-300 ease-out pointer-events-none ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85dvh' }}
      >
        {/* Close button */}
        <div className="flex justify-end px-4 pb-1.5 pointer-events-none">
          <button onClick={handleClose} className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full bg-black/40 active:bg-black/60 transition-colors" aria-label="Закрыть">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Sheet */}
        <div className="bg-white border-t border-x border-zinc-200 rounded-t-[16px] flex flex-col overflow-hidden min-h-0 flex-1 pointer-events-auto">
          <div className="flex items-center justify-center pt-2 shrink-0">
            <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
          </div>
          <div className="overflow-y-auto overscroll-contain min-h-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
