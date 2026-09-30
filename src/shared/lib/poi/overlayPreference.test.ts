import { describe, it, expect, beforeEach } from 'vitest'
import { readOverlayVisible, writeOverlayVisible } from './overlayPreference'

describe('состояние тогла слоя', () => {
  beforeEach(() => localStorage.clear())

  it('по умолчанию слой включён', () => {
    expect(readOverlayVisible()).toBe(true)
  })

  it('выключение запоминается', () => {
    writeOverlayVisible(false)
    expect(readOverlayVisible()).toBe(false)
  })

  it('включение обратно тоже запоминается', () => {
    writeOverlayVisible(false)
    writeOverlayVisible(true)
    expect(readOverlayVisible()).toBe(true)
  })

  it('мусор в хранилище не ломает умолчание', () => {
    localStorage.setItem('veshka_poi-overlay-visible', 'не-json')
    expect(readOverlayVisible()).toBe(true)
  })
})
