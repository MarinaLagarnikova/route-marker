import { describe, it, expect } from 'vitest'
import { buildCheckpoints } from './model'

// Minimal circular track: approximate ring
const circularTrack = [
  { lat: 55.000, lon: 37.000 },
  { lat: 55.005, lon: 37.010 },
  { lat: 55.010, lon: 37.000 },
  { lat: 55.005, lon: 36.990 },
  { lat: 55.001, lon: 36.999 },
]
const waypoints = [
  { lat: 55.005, lon: 37.010, name: 'КТ А' },
  { lat: 55.010, lon: 37.000, name: 'КТ Б' },
  { lat: 55.005, lon: 36.990, name: 'КТ В' },
]

describe('buildCheckpoints — circular', () => {
  it('does NOT add forced Старт/Финиш', () => {
    const cps = buildCheckpoints(circularTrack, waypoints, true)
    expect(cps.find(cp => cp.name === 'Старт')).toBeUndefined()
    expect(cps.find(cp => cp.name === 'Финиш')).toBeUndefined()
  })

  it('returns wpts from file when >= MIN_CHECKPOINTS_BEFORE_AUTO', () => {
    const cps = buildCheckpoints(circularTrack, waypoints, true)
    expect(cps.length).toBeGreaterThanOrEqual(3)
  })

  it('all returned checkpoints have valid distanceKm >= 0', () => {
    const cps = buildCheckpoints(circularTrack, waypoints, true)
    cps.forEach(cp => expect(cp.distanceKm).toBeGreaterThanOrEqual(0))
  })
})

describe('buildCheckpoints — linear (default)', () => {
  it('adds Старт at index 0', () => {
    const linearTrack = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.2, lon: 37.2 },
    ]
    const cps = buildCheckpoints(linearTrack, [], false)
    expect(cps[0].name).toBe('Старт')
  })

  it('adds Финиш at last position', () => {
    const linearTrack = [
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.2, lon: 37.2 },
    ]
    const cps = buildCheckpoints(linearTrack, [], false)
    expect(cps[cps.length - 1].name).toBe('Финиш')
  })
})
