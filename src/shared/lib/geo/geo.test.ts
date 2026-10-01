import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  cumulativeDistances,
  projectWptOnTrack,
  isCircularRoute,
  nearestTrackPoint,
  nearestContourPoint,
  pointAtKm,
  bearingAtKm,
  leftOfBearing,
} from './index'

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

  it('returns true when gap > 200m but within 2% of total route length', () => {
    // Build a ~350km route (100 steps of ~3.5km each going east)
    // then close it to within ~220m of start — gap > 200m but well under 2% of 350km
    const pts: Array<{ lat: number; lon: number }> = []
    for (let i = 0; i <= 100; i++) {
      pts.push({ lat: 55.0, lon: 37.0 + i * 0.05 })
    }
    // Last point ~220m from first (lat offset ~0.002° ≈ 222m)
    pts.push({ lat: 55.002, lon: 37.0 })
    expect(isCircularRoute(pts)).toBe(true)
  })
})

// Трек с шагом ~1.1 км на градус широты /100: 0.01° ≈ 1.11 км
const TRACK = [
  { lat: 55.0, lon: 37.0 },
  { lat: 55.01, lon: 37.0 },
  { lat: 55.02, lon: 37.0 },
  { lat: 55.03, lon: 37.0 },
]

describe('nearestTrackPoint', () => {
  it('returns index and distance to the closest track point', () => {
    const res = nearestTrackPoint({ lat: 55.0201, lon: 37.0 }, TRACK)
    expect(res.index).toBe(2)
    expect(res.distanceKm).toBeCloseTo(0.011, 2)
  })

  it('measures distance in kilometres, not degrees', () => {
    // 0.01° широты ≈ 1.11 км
    const res = nearestTrackPoint({ lat: 55.04, lon: 37.0 }, TRACK)
    expect(res.index).toBe(3)
    expect(res.distanceKm).toBeCloseTo(1.11, 1)
  })

  it('handles a single-point track', () => {
    const res = nearestTrackPoint({ lat: 55.0, lon: 37.0 }, [{ lat: 55.0, lon: 37.0 }])
    expect(res).toEqual({ index: 0, distanceKm: 0 })
  })
})

describe('nearestContourPoint', () => {
  it('picks the contour vertex closest to the track, not the centre', () => {
    // Болото: край касается трека, центр далеко на востоке
    const contour = [
      { lat: 55.015, lon: 37.001 }, // край у трека
      { lat: 55.015, lon: 37.2 },
      { lat: 55.025, lon: 37.2 },
    ]
    const res = nearestContourPoint(contour, TRACK)
    expect(res.point).toEqual({ lat: 55.015, lon: 37.001 })
    expect(res.distanceKm).toBeLessThan(0.7)
  })

  it('returns the vertex itself for a single-vertex contour', () => {
    const res = nearestContourPoint([{ lat: 55.0, lon: 37.0 }], TRACK)
    expect(res.point).toEqual({ lat: 55.0, lon: 37.0 })
    expect(res.distanceKm).toBeCloseTo(0, 5)
  })
})

describe('pointAtKm', () => {
  it('returns the first point at km 0', () => {
    expect(pointAtKm(TRACK, 0)).toEqual(TRACK[0])
  })

  it('interpolates between track points', () => {
    const distances = cumulativeDistances(TRACK)
    const total = distances[distances.length - 1]
    const mid = pointAtKm(TRACK, total / 2)
    expect(mid.lat).toBeCloseTo(55.015, 4)
    expect(mid.lon).toBeCloseTo(37.0, 4)
  })

  it('clamps beyond the end of the track', () => {
    expect(pointAtKm(TRACK, 9999)).toEqual(TRACK[TRACK.length - 1])
  })

  it('clamps before the start', () => {
    expect(pointAtKm(TRACK, -5)).toEqual(TRACK[0])
  })
})

describe('bearingAtKm', () => {
  // Трек TRACK идёт строго на север, поэтому направление везде нулевое
  it('returns 0 for a track running due north', () => {
    expect(bearingAtKm(TRACK, 1)).toBeCloseTo(0, 1)
  })

  it('returns 90 for a track running due east', () => {
    const east = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.0, lon: 37.01 },
      { lat: 55.0, lon: 37.02 },
    ]
    expect(bearingAtKm(east, 0.3)).toBeCloseTo(90, 1)
  })

  it('returns 180 for a track running due south', () => {
    const south = [
      { lat: 55.02, lon: 37.0 },
      { lat: 55.01, lon: 37.0 },
      { lat: 55.0, lon: 37.0 },
    ]
    expect(bearingAtKm(south, 0.5)).toBeCloseTo(180, 1)
  })

  // Фотография на повороте должна унаследовать направление того отрезка, на
  // котором стоит, а не усреднённое по всему треку
  it('takes the bearing of the segment the km falls into', () => {
    const corner = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.01, lon: 37.0 },  // на север
      { lat: 55.01, lon: 37.02 }, // дальше на восток
    ]
    const toCorner = haversineKm(corner[0], corner[1])
    expect(bearingAtKm(corner, toCorner / 2)).toBeCloseTo(0, 1)
    expect(bearingAtKm(corner, toCorner + 0.3)).toBeCloseTo(90, 1)
  })

  it('clamps beyond the end to the bearing of the last segment', () => {
    expect(bearingAtKm(TRACK, 9999)).toBeCloseTo(0, 1)
  })

  it('clamps before the start to the bearing of the first segment', () => {
    expect(bearingAtKm(TRACK, -5)).toBeCloseTo(0, 1)
  })

  it('returns 0 for a track too short to have a direction', () => {
    expect(bearingAtKm([{ lat: 55, lon: 37 }], 0)).toBe(0)
  })

  // Склеенные треки дают нулевые отрезки — направление берём у соседнего
  it('skips a zero-length segment instead of returning NaN', () => {
    const doubled = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.0, lon: 37.0 },
      { lat: 55.0, lon: 37.01 },
    ]
    expect(bearingAtKm(doubled, 0)).toBeCloseTo(90, 1)
  })
})

describe('leftOfBearing', () => {
  // Экранные оси: x вправо, y вниз. Идём на север — слева запад, то есть -x
  it('идём на север — отводит на запад', () => {
    const [x, y] = leftOfBearing(0, 10)
    expect(x).toBeCloseTo(-10, 5)
    expect(y).toBeCloseTo(0, 5)
  })

  it('идём на восток — отводит на север, то есть вверх по экрану', () => {
    const [x, y] = leftOfBearing(90, 10)
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(-10, 5)
  })

  it('идём на юг — отводит на восток', () => {
    const [x, y] = leftOfBearing(180, 10)
    expect(x).toBeCloseTo(10, 5)
    expect(y).toBeCloseTo(0, 5)
  })

  it('идём на запад — отводит на юг, то есть вниз по экрану', () => {
    const [x, y] = leftOfBearing(270, 10)
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(10, 5)
  })

  it('длина отвода не зависит от направления', () => {
    for (const bearing of [0, 13.6, 150.8, 236.4, 261.5, 350.7]) {
      const [x, y] = leftOfBearing(bearing, 35)
      expect(Math.hypot(x, y), `беаринг ${bearing}`).toBeCloseTo(35, 5)
    }
  })

  // Снимок на тропе: отвод обязан быть поперёк, иначе плашка едет вдоль линии
  it('отвод перпендикулярен ходу движения', () => {
    for (const bearing of [0, 13.6, 90, 150.8, 236.4, 261.5, 350.7]) {
      const rad = (bearing * Math.PI) / 180
      const travel = [Math.sin(rad), -Math.cos(rad)]
      const [x, y] = leftOfBearing(bearing, 35)
      const dot = travel[0] * x + travel[1] * y
      expect(dot, `беаринг ${bearing}`).toBeCloseTo(0, 5)
    }
  })
})
