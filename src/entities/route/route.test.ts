import { describe, it, expect } from 'vitest'
import { detectDirection, applyCheckmark, computeFinishForecast } from './model'
import type { Checkpoint } from '@/entities/checkpoint'

function makeCheckpoints(n: number): Checkpoint[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `cp_${i}`,
    name: `КТ ${i}`,
    lat: 0,
    lon: i * 0.1,
    trackIndex: i * 10,
    distanceKm: i * 1.0,
  }))
}

describe('detectDirection', () => {
  it('forward when first mark is in first half', () => {
    expect(detectDirection(makeCheckpoints(10), 2, 10)).toBe('forward')
  })
  it('reverse when first mark is in second half', () => {
    expect(detectDirection(makeCheckpoints(10), 7, 10)).toBe('reverse')
  })
})

describe('applyCheckmark', () => {
  it('marks target and all previous', () => {
    const cps = makeCheckpoints(5)
    const result = applyCheckmark(cps, 2, Date.now())
    expect(result[0].checkedAt).toBeDefined()
    expect(result[1].checkedAt).toBeDefined()
    expect(result[2].checkedAt).toBeDefined()
    expect(result[3].checkedAt).toBeUndefined()
  })
})

describe('computeFinishForecast', () => {
  it('returns null when fewer than 2 checked', () => {
    const cps = makeCheckpoints(5)
    cps[0].checkedAt = 1000
    expect(computeFinishForecast(cps)).toBeNull()
  })
  it('returns a timestamp when >=2 checked', () => {
    const cps = makeCheckpoints(5)
    cps[0].checkedAt = 0
    cps[1].checkedAt = 3_600_000
    const result = computeFinishForecast(cps)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('number')
  })
})
