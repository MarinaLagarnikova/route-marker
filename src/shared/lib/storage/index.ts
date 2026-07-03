import { STORAGE_KEY_PREFIX } from '@/shared/config'

export function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value))
  } catch {
    // quota exceeded — ignore silently
  }
}

export function storageRemove(key: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + key)
}

export function storageKeys(): string[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_KEY_PREFIX))
    .map((k) => k.slice(STORAGE_KEY_PREFIX.length))
}
