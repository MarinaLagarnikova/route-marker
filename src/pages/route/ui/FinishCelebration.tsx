import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  onDone: () => void
}

export function FinishCelebration({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const fire = confetti.create(canvas, { resize: true, useWorker: true })

    fire({
      particleCount: 120,
      spread: 90,
      origin: { x: 0.5, y: 0.6 },
      startVelocity: 45,
      ticks: 200,
    })

    fire({
      particleCount: 60,
      spread: 120,
      origin: { x: 0.3, y: 0.65 },
      startVelocity: 35,
      ticks: 200,
      angle: 70,
    })

    fire({
      particleCount: 60,
      spread: 120,
      origin: { x: 0.7, y: 0.65 },
      startVelocity: 35,
      ticks: 200,
      angle: 110,
    })

    const timer = setTimeout(onDone, 3000)
    return () => {
      clearTimeout(timer)
      fire.reset()
    }
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
    />
  )
}
