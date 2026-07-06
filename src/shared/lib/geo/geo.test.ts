import { describe, it, expect } from 'vitest'
import { haversineKm, cumulativeDistances, projectWptOnTrack, isCircularRoute } from './index'

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm({ lat: 55.75, lon: 37.61 }, { lat: 55.75, lon: 37.61 })).toBeCloseTo(0)
  })
  it('Moscow to SPb ~635km', () => {
    expect(haversineKm({ lat: 55.75, lon: 37.61 }, { lat: 59.93, lon: 30.32 })).toBeCloseTo(635, -1)
  })
})

describe('cumulativeDistances', () => {
  it('first element is always 0', () => {
    const pts = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }]
    expect(cumulativeDistances(pts)[0]).toBe(0)
  })
  it('returns array same length as input', () => {
    const pts = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]
    expect(cumulativeDistances(pts)).toHaveLength(3)
  })
  it('distances are monotonically increasing', () => {
    const pts = [{ lat: 55, lon: 37 }, { lat: 55.1, lon: 37 }, { lat: 55.2, lon: 37 }]
    const d = cumulativeDistances(pts)
    expect(d[1]).toBeGreaterThan(d[0])
    expect(d[2]).toBeGreaterThan(d[1])
  })
})

describe('projectWptOnTrack', () => {
  it('returns index of nearest track point', () => {
    const track = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]
    expect(projectWptOnTrack({ lat: 0, lon: 0.9 }, track)).toBe(1)
  })
})

describe('isCircularRoute', () => {
  it('returns false for linear track', () => {
    const track = [{ lat: 55.0, lon: 37.0 }, { lat: 55.5, lon: 37.5 }, { lat: 56.0, lon: 38.0 }]
    expect(isCircularRoute(track)).toBe(false)
  })

  it('returns true when first and last points are very close (< 200m)', () => {
    // loop: last point ~1m from first
    const track = [
      { lat: 55.750000, lon: 37.610000 },
      { lat: 55.755000, lon: 37.620000 },
      { lat: 55.760000, lon: 37.610000 },
      { lat: 55.750001, lon: 37.610001 },
    ]
    expect(isCircularRoute(track)).toBe(true)
  })

  it('returns false for short track with far endpoints', () => {
    const track = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.5, lon: 38.0 },
    ]
    expect(isCircularRoute(track)).toBe(false)
  })

  it('returns false for track with fewer than 3 points', () => {
    expect(isCircularRoute([{ lat: 55.0, lon: 37.0 }, { lat: 55.1, lon: 37.1 }])).toBe(false)
  })
})
