import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch {}
}

interface Props {
  visible: boolean
}

const BEEP_TOTAL = 3
const BEEP_INTERVAL_MS = 30_000

export function OffRouteBanner({ visible }: Props) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (visible) {
      // Play 3 beeps: immediately, +30s, +60s — then stop
      for (let i = 0; i < BEEP_TOTAL; i++) {
        const t = setTimeout(playBeep, i * BEEP_INTERVAL_MS)
        timersRef.current.push(t)
      }
    }
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-md">
        <TriangleAlert className="text-amber-500 shrink-0" size={16} />
        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
          Вы не на маршруте
        </p>
      </div>
    </div>
  )
}
