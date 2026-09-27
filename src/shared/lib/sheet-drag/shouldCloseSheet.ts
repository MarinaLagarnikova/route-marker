/** Протащили достаточно далеко — закрываем, даже если отпустили медленно. */
export const CLOSE_DISTANCE_PX = 96

/** Короткий резкий флик закрывает шторку, не доходя до порога расстояния. */
export const CLOSE_VELOCITY_PX_PER_MS = 0.5

/** Меньше этого — дрожание пальца, а не жест. */
export const DRAG_START_PX = 6

/**
 * Решение по завершённому жесту: закрыть шторку или вернуть на место.
 *
 * Скорость важна наравне с расстоянием — иначе быстрый короткий смах вниз,
 * который человек читает как «закрой», оставляет шторку открытой.
 */
export function shouldCloseSheet(distancePx: number, durationMs: number): boolean {
  if (distancePx <= 0) return false
  if (distancePx > CLOSE_DISTANCE_PX) return true
  const velocity = distancePx / Math.max(1, durationMs)
  return velocity > CLOSE_VELOCITY_PX_PER_MS
}
