import { describe, it, expect } from 'vitest'
import { shouldCloseSheet } from './shouldCloseSheet'

describe('shouldCloseSheet', () => {
  it('не закрывает, если палец не двигался', () => {
    expect(shouldCloseSheet(0, 200)).toBe(false)
  })

  it('не закрывает при движении вверх', () => {
    expect(shouldCloseSheet(-120, 200)).toBe(false)
  })

  it('закрывает, когда шторку утащили дальше порога', () => {
    expect(shouldCloseSheet(200, 2000)).toBe(true)
  })

  it('не закрывает медленное короткое движение', () => {
    expect(shouldCloseSheet(40, 600)).toBe(false)
  })

  it('закрывает быстрый короткий смах', () => {
    expect(shouldCloseSheet(40, 50)).toBe(true)
  })

  it('переживает нулевую длительность и не делит на ноль', () => {
    expect(shouldCloseSheet(30, 0)).toBe(true)
  })
})
