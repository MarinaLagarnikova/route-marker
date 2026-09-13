import { describe, it, expect } from 'vitest'
import { parseTrackFile } from './index'
import { DEFLATED_KMZ, fixtureBuffer } from '@/shared/lib/kmz/__fixtures__'

const GPX_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"><trk><name>Тропа</name><trkseg>
  <trkpt lat="55.0" lon="37.0"/><trkpt lat="55.1" lon="37.1"/>
</trkseg></trk></gpx>`

const KML_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Тропа</name>
  <Placemark><LineString><coordinates>37.0,55.0 37.1,55.1</coordinates></LineString></Placemark>
</Document></kml>`

function kmzFile(name = 'track.kmz'): File {
  return new File([fixtureBuffer(DEFLATED_KMZ)], name)
}

describe('parseTrackFile', () => {
  it('parses a GPX file and keeps the original XML', async () => {
    const result = await parseTrackFile(new File([GPX_TEXT], 'route.gpx'))

    expect(result.data.name).toBe('Тропа')
    expect(result.data.trackPoints).toHaveLength(2)
    expect(result.xml).toBe(GPX_TEXT)
  })

  it('parses a KMZ file, returning GPX XML so the route stays shareable', async () => {
    const result = await parseTrackFile(kmzFile())

    expect(result.data.name).toBe('Поход на Таганай')
    expect(result.data.trackPoints.length).toBeGreaterThan(1)
    expect(result.data.waypoints).toContainEqual(
      expect.objectContaining({ name: 'Ночёвка у ручья' })
    )
    expect(result.xml).toContain('<trkpt')
  })

  it('parses a bare KML file', async () => {
    const result = await parseTrackFile(new File([KML_TEXT], 'route.kml'))

    expect(result.data.name).toBe('Тропа')
    expect(result.data.trackPoints).toHaveLength(2)
  })

  it('detects a KMZ by its zip signature even when the extension says gpx', async () => {
    const result = await parseTrackFile(kmzFile('renamed.gpx'))

    expect(result.data.name).toBe('Поход на Таганай')
  })

  it('rejects a file that is neither GPX, KML nor KMZ', async () => {
    const file = new File(['просто текст, не трек'], 'notes.txt')

    await expect(parseTrackFile(file)).rejects.toThrow(/GPX, KML или KMZ/)
  })

  it('propagates the GPX error when a GPX file has no track', async () => {
    const file = new File(['<?xml version="1.0"?><gpx version="1.1"><trk/></gpx>'], 'empty.gpx')

    await expect(parseTrackFile(file)).rejects.toThrow(/не содержит трека/)
  })
})
