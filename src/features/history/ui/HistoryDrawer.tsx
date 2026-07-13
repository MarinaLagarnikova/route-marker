import { useEffect, useState } from 'react'
import { Locate, Check, Timer, Flag } from 'lucide-react'
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

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-x border-zinc-200 rounded-t-[16px] max-w-[560px] mx-auto flex flex-col overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85dvh' }}
      >
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1">
          {/* Handle */}
          <div className="flex items-center justify-center pt-2">
            <div className="w-[50px] h-1 bg-zinc-400 rounded-full" />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-6 px-4 pt-4 pb-8">
            {/* Title */}
            <h2 className="text-xl font-semibold text-zinc-900">История</h2>

            {/* Total duration card */}
            {netWalkTime !== null && Math.round(netWalkTime / 60000) > 0 && (
              <div className="bg-zinc-100 rounded-[16px] p-4 flex items-center gap-2">
                <Timer className="w-6 h-6 text-zinc-900 shrink-0" />
                <p className="text-sm font-medium">
                  <span className="text-zinc-900">{formatDuration(netWalkTime)} </span>
                  <span className="text-zinc-500">
                    {isMultiDay ? 'чистого ходового времени' : 'занял весь маршрут'}
                  </span>
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="flex flex-col gap-4">
              {/* Start */}
              <div className="flex items-center gap-2">
                <Locate className="w-4 h-4 shrink-0 text-zinc-900" />
                <span className="text-sm font-semibold text-zinc-900">
                  {start.checkedAt
                    ? `Старт в ${formatTime(start.checkedAt)}${isMultiDay ? ` · ${formatDate(start.checkedAt)}` : ''}`
                    : 'Старт'}
                </span>
              </div>

              {/* Middle checkpoints */}
              {middle.length > 0 && (
                <div className="flex flex-col gap-3">
                  {middle.map((cp, i) => {
                    const isLast = i === middle.length - 1
                    const checked = cp.checkedAt !== undefined
                    const prev = i > 0 ? middle[i - 1] : start
                    const isNewDay =
                      isMultiDay &&
                      checked &&
                      prev.checkedAt !== undefined &&
                      calendarDay(cp.checkedAt!) !== calendarDay(prev.checkedAt!)
                    const nextCp = i < middle.length - 1 ? middle[i + 1] : null
                    const isBeforeDayBreak =
                      isMultiDay &&
                      checked &&
                      nextCp?.checkedAt !== undefined &&
                      calendarDay(cp.checkedAt!) !== calendarDay(nextCp.checkedAt!)

                    return (
                      <div key={cp.id}>
                        {isNewDay && (
                          <div className="flex items-center gap-2 mb-3">
                            <Locate className="w-4 h-4 shrink-0 text-zinc-900" />
                            <span className="text-sm font-semibold text-zinc-900">
                              Старт в {formatTime(cp.checkedAt!)} · {formatDate(cp.checkedAt!)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 pl-4">
                          <div className="relative shrink-0 w-6 h-6 flex items-center justify-center">
                            {!isLast && !isBeforeDayBreak && (
                              <div className="absolute left-[11px] top-[15px] w-px h-[38px] bg-zinc-200" />
                            )}
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-100 shadow-[0_0_0_1px_#d1d5db]" />
                          </div>
                          <span className="flex-1 text-sm font-normal text-zinc-900">
                            {cp.distanceKm.toFixed(1)} км
                            {checked && cp.checkedAt ? ` · ${formatTime(cp.checkedAt)}` : ''}
                          </span>
                          {checked && (
                            <Check className="w-4 h-4 shrink-0 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Finish */}
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 shrink-0 text-zinc-900" />
                <span className="text-sm font-semibold text-zinc-900">
                  {finish.checkedAt
                    ? `Финиш в ${formatTime(finish.checkedAt)}${isMultiDay ? ` · ${formatDate(finish.checkedAt)}` : ''}`
                    : 'Финиш'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
