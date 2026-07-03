import { describe, it, expect } from 'vitest'
import { parseGpx } from './index'

const SIMPLE_GPX = `<?xml version="1.0"?>
<gpx>
  <metadata><name>Test Route</name></metadata>
  <trk>
    <trkseg>
      <trkpt lat="55.0" lon="37.0"/>
      <trkpt lat="55.1" lon="37.1"/>
      <trkpt lat="55.2" lon="37.2"/>
    </trkseg>
  </trk>
  <wpt lat="55.1" lon="37.1"><name>Середина</name></wpt>
</gpx>`

const NO_TRACK_GPX = `<?xml version="1.0"?><gpx></gpx>`

describe('parseGpx', () => {
  it('parses track points', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.trackPoints).toHaveLength(3)
    expect(result.trackPoints[0]).toMatchObject({ lat: 55.0, lon: 37.0 })
  })

  it('parses metadata name', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.name).toBe('Test Route')
  })

  it('parses waypoints', () => {
    const result = parseGpx(SIMPLE_GPX)
    expect(result.waypoints).toHaveLength(1)
    expect(result.waypoints[0].name).toBe('Середина')
  })

  it('throws on missing track', () => {
    expect(() => parseGpx(NO_TRACK_GPX)).toThrow()
  })
})
