import { storageGet, storageSet } from '@/shared/lib/storage'

/** Ключ один на всё приложение: выключил слой однажды — выключен везде. */
const KEY = 'poi-overlay-visible'

export function readOverlayVisible(): boolean {
  const stored = storageGet<boolean>(KEY)
  return typeof stored === 'boolean' ? stored : true
}

export function writeOverlayVisible(visible: boolean): void {
  storageSet(KEY, visible)
}
