import { describe, it, expect } from 'vitest'
import { kmlToGpx } from './kml'
import { parseGpx } from '@/shared/lib/gpx'

describe('kmlToGpx', () => {
  it('converts LineString coordinates to a GPX track (lon,lat order swapped)', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>37.0,55.0,120 37.1,55.1,130 37.2,55.2,140</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`

    const parsed = parseGpx(kmlToGpx(kml))

    expect(parsed.trackPoints).toEqual([
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.2, lon: 37.2 },
    ])
  })

  it('converts Point placemarks to named waypoints', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>37.0,55.0 37.2,55.2</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>Брод</name>
      <Point><coordinates>37.05,55.05,0</coordinates></Point>
    </Placemark>
    <Placemark>
      <Point><coordinates>37.15,55.15,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`

    const parsed = parseGpx(kmlToGpx(kml))

    expect(parsed.waypoints).toEqual([
      { lat: 55.05, lon: 37.05, name: 'Брод' },
      { lat: 55.15, lon: 37.15, name: 'Точка' },
    ])
  })

  it('takes the route name from Document, falling back to the track placemark', () => {
    const track = `<LineString><coordinates>37.0,55.0 37.2,55.2</coordinates></LineString>`

    const withDocName = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Поход на Таганай</name>
    <Placemark><name>Трек</name>${track}</Placemark>
  </Document>
</kml>`

    const withoutDocName = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark><name>Трек</name>${track}</Placemark>
  </Document>
</kml>`

    expect(parseGpx(kmlToGpx(withDocName)).name).toBe('Поход на Таганай')
    expect(parseGpx(kmlToGpx(withoutDocName)).name).toBe('Трек')
  })

  it('falls back to the placemark name for a gx:Track without a document name', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <Placemark>
      <name>Запись 12 сентября</name>
      <gx:Track>
        <gx:coord>37.0 55.0 120</gx:coord>
        <gx:coord>37.1 55.1 130</gx:coord>
      </gx:Track>
    </Placemark>
  </Document>
</kml>`

    expect(parseGpx(kmlToGpx(kml)).name).toBe('Запись 12 сентября')
  })

  it('escapes XML-special characters in names', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Лес &amp; горы &lt;2026&gt;</name>
    <Placemark><LineString><coordinates>37.0,55.0 37.2,55.2</coordinates></LineString></Placemark>
  </Document>
</kml>`

    expect(parseGpx(kmlToGpx(kml)).name).toBe('Лес & горы <2026>')
  })

  it('converts gx:Track coords (space-separated lon lat ele) to a track', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <Placemark>
      <gx:Track>
        <when>2026-09-01T08:00:00Z</when>
        <gx:coord>37.0 55.0 120</gx:coord>
        <when>2026-09-01T08:05:00Z</when>
        <gx:coord>37.1 55.1 130</gx:coord>
        <when>2026-09-01T08:10:00Z</when>
        <gx:coord>37.2 55.2 140</gx:coord>
      </gx:Track>
    </Placemark>
  </Document>
</kml>`

    const parsed = parseGpx(kmlToGpx(kml))

    expect(parsed.trackPoints).toEqual([
      { lat: 55.0, lon: 37.0 },
      { lat: 55.1, lon: 37.1 },
      { lat: 55.2, lon: 37.2 },
    ])
  })

  it('keeps MultiGeometry line strings as separate track segments', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <MultiGeometry>
        <LineString><coordinates>37.0,55.0 37.1,55.1</coordinates></LineString>
        <LineString><coordinates>37.1,55.1 37.2,55.2</coordinates></LineString>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`

    expect(parseGpx(kmlToGpx(kml)).trackSegments).toHaveLength(2)
  })

  it('throws a format-specific error when the file has no track', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Только закладки</name>
    <Placemark><name>Стоянка</name><Point><coordinates>37.0,55.0</coordinates></Point></Placemark>
  </Document>
</kml>`

    expect(() => kmlToGpx(kml)).toThrow(/KML|KMZ/)
  })

  it('throws when the KML is not valid XML', () => {
    expect(() => kmlToGpx('not xml at all <<<')).toThrow(/повреждён/)
  })
})
