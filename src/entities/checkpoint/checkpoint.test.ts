import { describe, it, expect } from 'vitest'
import { buildCheckpoints, getLastChecked, canUncheck } from './model'
import type { LatLon } from '@/shared/lib/geo'

const track: LatLon[] = [
  { lat: 0, lon: 0 },
  { lat: 0, lon: 1 },
  { lat: 0, lon: 2 },
  { lat: 0, lon: 3 },
]

describe('buildCheckpoints', () => {
  it('always adds Start and Finish', () => {
    const cps = buildCheckpoints(track, [])
    expect(cps[0].name).toBe('Старт')
    expect(cps[cps.length - 1].name).toBe('Финиш')
  })

  it('auto-generates checkpoints when <3 waypoints', () => {
    const cps = buildCheckpoints(track, [])
    expect(cps.length).toBeGreaterThan(2)
  })

  it('uses provided waypoints when >=3 given', () => {
    const wpts = [
      { lat: 0, lon: 0.5, name: 'A' },
      { lat: 0, lon: 1.5, name: 'B' },
      { lat: 0, lon: 2.5, name: 'C' },
    ]
    const cps = buildCheckpoints(track, wpts)
    const names = cps.map((c) => c.name)
    expect(names).toContain('A')
  })
})

describe('canUncheck', () => {
  it('returns false for non-last checked', () => {
    const cps = buildCheckpoints(track, [])
    const marked = cps.map((c, i) => ({ ...c, checkedAt: i < 2 ? Date.now() : undefined }))
    expect(canUncheck(marked, 0)).toBe(false)
  })
  it('returns true for last checked', () => {
    const cps = buildCheckpoints(track, [])
    const marked = cps.map((c, i) => ({ ...c, checkedAt: i === 0 ? Date.now() : undefined }))
    expect(canUncheck(marked, 0)).toBe(true)
  })
})

describe('getLastChecked', () => {
  it('returns -1 when none checked', () => {
    const cps = buildCheckpoints(track, [])
    expect(getLastChecked(cps)).toBe(-1)
  })
  it('returns correct last index', () => {
    const cps = buildCheckpoints(track, [])
    const marked = cps.map((c, i) => ({ ...c, checkedAt: i < 2 ? Date.now() : undefined }))
    expect(getLastChecked(marked)).toBe(1)
  })
})
