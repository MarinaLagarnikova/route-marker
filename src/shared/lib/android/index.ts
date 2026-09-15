/**
 * Мост в нативную оболочку Android.
 *
 * Приложение — это WebView с тем же билдом, что и сайт, плюс нативный слой для
 * того, что браузер не умеет: фоновый GPS при свёрнутом приложении, уведомления,
 * системный шаринг. В обычном браузере моста нет, и весь модуль превращается в
 * набор заглушек — вызывающему коду проверять окружение не нужно.
 */

interface AndroidBridge {
  isAndroid(): boolean
  startTracking(checkpointsJson: string, trackPointsJson: string): void
  stopTracking(): void
  shareGpx(gpxXml: string, routeName: string): void
  openFilePicker(): void
  markCheckpoint(index: number): void
  getAssetFile(path: string): string
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridge
    onGpsPosition?: (lat: number, lon: number, accuracy: number, speed: number | null) => void
    onCheckpointAutoMarked?: (index: number) => void
    onOffRouteAlert?: () => void
    /** Файл приходит в base64: KMZ — это бинарный архив, строкой его не передать. */
    onFileOpened?: (base64: string) => void
  }
}

export interface AndroidPosition {
  lat: number
  lon: number
  accuracy: number
  speed: number | null
}

function bridge(): AndroidBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.AndroidBridge
}

export function isAndroidApp(): boolean {
  try {
    return bridge()?.isAndroid() === true
  } catch {
    return false
  }
}

/**
 * Запускает фоновое слежение. Вызывается и при каждом изменении отметок —
 * сервис пересчитывает состояние из присланных данных, так что это же и
 * способ его синхронизировать.
 */
export function startBackgroundTracking(
  checkpoints: { lat: number; lon: number; checkedAt?: number }[],
  trackPoints: { lat: number; lon: number }[]
): void {
  bridge()?.startTracking(
    JSON.stringify(checkpoints.map(({ lat, lon, checkedAt }) => ({ lat, lon, checkedAt: checkedAt ?? null }))),
    JSON.stringify(trackPoints.map(({ lat, lon }) => ({ lat, lon })))
  )
}

export function stopBackgroundTracking(): void {
  bridge()?.stopTracking()
}

/** Возвращает false, если нативного шаринга нет и нужно уходить в веб-путь. */
export function shareGpxNative(gpxXml: string, routeName: string): boolean {
  const api = bridge()
  if (!api) return false
  api.shareGpx(gpxXml, routeName)
  return true
}

/**
 * Подписка на события из нативного слоя.
 *
 * Нативная сторона зовёт одну глобальную функцию на событие, поэтому подписчиков
 * приходится мультиплексировать: без этого второй компонент затёр бы первого.
 */
type Listener<T extends unknown[]> = (...args: T) => void

function subscribe<T extends unknown[]>(
  key: 'onGpsPosition' | 'onCheckpointAutoMarked' | 'onOffRouteAlert' | 'onFileOpened',
  listeners: Set<Listener<T>>,
  listener: Listener<T>
): () => void {
  listeners.add(listener)
  if (!window[key]) {
    // @ts-expect-error — сигнатуры глобальных колбэков различаются, ключ их сужает
    window[key] = (...args: T) => listeners.forEach((fn) => fn(...args))
  }
  return () => {
    listeners.delete(listener)
  }
}

const gpsListeners = new Set<Listener<[number, number, number, number | null]>>()
const autoMarkListeners = new Set<Listener<[number]>>()
const offRouteListeners = new Set<Listener<[]>>()
const fileListeners = new Set<Listener<[string]>>()

/** Позиция от фонового сервиса — замена navigator.geolocation внутри приложения. */
export function onAndroidPosition(listener: (position: AndroidPosition) => void): () => void {
  return subscribe('onGpsPosition', gpsListeners, (lat, lon, accuracy, speed) =>
    listener({ lat, lon, accuracy, speed })
  )
}

/** Точку отметил фоновый сервис, пока приложение было свёрнуто. */
export function onAndroidCheckpointAutoMarked(listener: (index: number) => void): () => void {
  return subscribe('onCheckpointAutoMarked', autoMarkListeners, listener)
}

export function onAndroidOffRoute(listener: () => void): () => void {
  return subscribe('onOffRouteAlert', offRouteListeners, listener)
}

/** Файл, открытый снаружи («Поделиться → Вешка»). Приходит в base64. */
export function onAndroidFileOpened(listener: (file: File) => void): () => void {
  return subscribe('onFileOpened', fileListeners, (base64: string) => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    // Имя условное: формат всё равно определяется по содержимому.
    listener(new File([bytes], 'track', { type: 'application/octet-stream' }))
  })
}
