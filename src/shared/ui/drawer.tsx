import { useEffect, useState } from 'react'

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

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-x border-zinc-200 rounded-t-[16px] max-w-[560px] mx-auto flex flex-col overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85dvh' }}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-2 shrink-0">
          <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1">
          {children}
        </div>
      </div>
    </>
  )
}
