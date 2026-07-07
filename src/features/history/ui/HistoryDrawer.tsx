import { useEffect, useState } from 'react'
import { MapPin, Check, Timer, Flag } from 'lucide-react'
import type { Checkpoint } from '@/entities/checkpoint'

interface Props {
  checkpoints: Checkpoint[]
  onClose: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'минута' : m < 5 ? 'минуты' : 'минут'}`)
  return parts.join(' ')
}

/** Returns 'YYYY-MM-DD' string for grouping by calendar day */
function calendarDay(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns 'D MMMM' in Russian, e.g. '3 июля' */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** Clean walking time = sum of (last_checkedAt_of_day - first_checkedAt_of_day) per day */
function calcNetWalkTime(checkpoints: Checkpoint[]): number | null {
  const checked = checkpoints.filter((cp) => cp.checkedAt !== undefined)
  if (checked.length < 2) return null

  const byDay = new Map<string, number[]>()
  for (const cp of checked) {
    const day = calendarDay(cp.checkedAt!)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(cp.checkedAt!)
  }

  let total = 0
  for (const timestamps of byDay.values()) {
    const min = Math.min(...timestamps)
    const max = Math.max(...timestamps)
    total += max - min
  }
  return total > 0 ? total : null
}

export function HistoryDrawer({ checkpoints, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const start = checkpoints[0]
  const finish = checkpoints[checkpoints.length - 1]
  const middle = checkpoints.slice(1, -1)

  const allChecked =
    checkpoints.length > 0 && checkpoints.every((cp) => cp.checkedAt !== undefined)

  const allCheckedInRoute = checkpoints.filter((cp) => cp.checkedAt !== undefined)
  const uniqueDays = new Set(allCheckedInRoute.map((cp) => calendarDay(cp.checkedAt!)))
  const isMultiDay = uniqueDays.size > 1

  const netWalkTime = allChecked ? calcNetWalkTime(checkpoints) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border border-[#e5e5e5] rounded-t-[10px] max-w-[560px] mx-auto flex flex-col overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`} style={{ maxHeight: '85dvh' }}>
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1">
        {/* Handle */}
        <div className="flex items-center justify-center pt-4">
          <div className="w-[100px] h-2 bg-[#e5e5e5] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pt-4 pb-0">
          <h2 className="text-xl font-semibold leading-7 text-[#0a0a0a]">История</h2>
        </div>

        <div className="pb-6">
          {/* Total duration card (only when completed) */}
          {netWalkTime !== null && Math.round(netWalkTime / 60000) > 0 && (
            <div className="mx-4 mt-4 bg-[#f5f5f5] rounded-[8px] px-4 py-4 flex items-center gap-2">
              <Timer className="w-6 h-6 text-[#0a0a0a] shrink-0" />
              <p className="text-sm leading-5">
                <span className="font-medium text-[#0a0a0a]">{formatDuration(netWalkTime)} </span>
                <span className="text-[#737373]">
                  {isMultiDay ? 'чистого ходового времени' : 'занял весь маршрут'}
                </span>
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="px-4 pt-3 flex flex-col gap-6">
            {/* Start */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#171717]" />
              </div>
              <span className="text-sm font-semibold leading-5 text-[#171717]">
                {start.checkedAt
                  ? `Старт в ${formatTime(start.checkedAt)}${isMultiDay ? ` · ${formatDate(start.checkedAt)}` : ''}`
                  : 'Старт'}
              </span>
            </div>

            {/* Middle checkpoints */}
            {middle.length > 0 && (
              <div className="flex flex-col gap-4">
                {middle.map((cp, i) => {
                  const isLast = i === middle.length - 1
                  const checked = cp.checkedAt !== undefined
                  const prev = i > 0 ? middle[i - 1] : start
                  const isNewDay =
                    isMultiDay &&
                    checked &&
                    prev.checkedAt !== undefined &&
                    calendarDay(cp.checkedAt!) !== calendarDay(prev.checkedAt!)

                  return (
                    <div key={cp.id}>
                      {isNewDay && (
                        <div className="py-2 mb-2">
                          <span className="text-sm font-semibold text-[#171717]">
                            Старт в {formatTime(cp.checkedAt!)} · {formatDate(cp.checkedAt!)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                          {!isLast && (
                            <div className="absolute left-[11px] top-[15px] w-px h-[38px] bg-[#e5e7eb]" />
                          )}
                          <div className="w-1.5 h-1.5 rounded-full bg-[#f3f4f6] ring-1 ring-[#d1d5db]" />
                        </div>
                        <span
                          className={[
                            'flex-1 text-sm leading-5',
                            checked ? 'text-[#737373]' : 'text-[#0a0a0a]',
                          ].join(' ')}
                        >
                          {cp.distanceKm.toFixed(1)} км
                          {checked && cp.checkedAt ? ` · ${formatTime(cp.checkedAt)}` : ''}
                        </span>
                        <Check
                          className={[
                            'w-4 h-4 shrink-0',
                            checked ? 'text-[#737373]' : 'text-[#d1d5db]',
                          ].join(' ')}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Finish */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                <Flag className="w-5 h-5 text-[#171717]" />
              </div>
              <span className="text-sm font-semibold leading-5 text-[#171717]">
                {finish.checkedAt ? `Финиш в ${formatTime(finish.checkedAt)}` : 'Финиш'}
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
