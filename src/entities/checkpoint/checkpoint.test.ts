import { describe, it, expect } from 'vitest'
import { buildCheckpoints, getLastChecked, canUncheck } from './model'
import type { LatLon } from '@/shared/lib/geo'

// Realistic track: ~3 km route heading north, points ~0.44 km apart
const track: LatLon[] = [
  { lat: 55.000, lon: 37.000 },
  { lat: 55.004, lon: 37.000 },
  { lat: 55.008, lon: 37.000 },
  { lat: 55.012, lon: 37.000 },
  { lat: 55.016, lon: 37.000 },
  { lat: 55.020, lon: 37.000 },
  { lat: 55.024, lon: 37.000 },
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
    // Waypoints offset 0.001° lon (~0.06 km) from the track — well within 0.5 km limit
    const wpts = [
      { lat: 55.004, lon: 37.001, name: 'A' },
      { lat: 55.012, lon: 37.001, name: 'B' },
      { lat: 55.020, lon: 37.001, name: 'C' },
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
