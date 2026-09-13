interface KmlPoint {
  lat: number
  lon: number
  /** Kept for library authoring and sharing; the route parser itself ignores elevation. */
  ele?: number
}

interface KmlWaypoint extends KmlPoint {
  name?: string
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Parses a KML `<coordinates>` blob: whitespace-separated `lon,lat[,ele]` tuples. */
function parseCoordinates(text: string): KmlPoint[] {
  return text
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [lon, lat, ele] = tuple.split(',')
      const point: KmlPoint = { lat: parseFloat(lat), lon: parseFloat(lon) }
      if (ele !== undefined && Number.isFinite(parseFloat(ele))) point.ele = parseFloat(ele)
      return point
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

/** Converts KML text into GPX XML text, so the existing GPX pipeline can consume it. */
export function kmlToGpx(kml: string): string {
  const doc = new DOMParser().parseFromString(kml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Файл повреждён: не удалось разобрать XML')
  }

  const segments = [...readLineStrings(doc), ...readGxTracks(doc)].filter((seg) => seg.length >= 2)

  if (segments.length === 0) {
    throw new Error(
      'В KML/KMZ-файле нет линии маршрута (нужен трек, а не только точки)'
    )
  }

  const waypoints: KmlWaypoint[] = Array.from(doc.querySelectorAll('Placemark > Point > coordinates'))
    .flatMap((el) => {
      const [point] = parseCoordinates(el.textContent ?? '')
      if (!point) return []
      const placemark = el.parentElement?.parentElement
      const name = placemark?.querySelector(':scope > name')?.textContent?.trim()
      return [{ ...point, name: name || undefined }]
    })

  return buildGpx(segments, waypoints, readName(doc))
}

/** Classic KML geometry: `<LineString><coordinates>`, including inside `<MultiGeometry>`. */
function readLineStrings(doc: Document): KmlPoint[][] {
  return Array.from(doc.querySelectorAll('LineString > coordinates')).map((el) =>
    parseCoordinates(el.textContent ?? '')
  )
}

/** Google extension used by Organic Maps: `<gx:Track>` with one `<gx:coord>lon lat ele</gx:coord>` per fix. */
function readGxTracks(doc: Document): KmlPoint[][] {
  return Array.from(doc.getElementsByTagNameNS('*', 'Track')).map((track) =>
    Array.from(track.getElementsByTagNameNS('*', 'coord')).flatMap((el) => {
      const [lon, lat, ele] = (el.textContent ?? '').trim().split(/\s+/).map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
      const point: KmlPoint = { lat, lon }
      if (Number.isFinite(ele)) point.ele = ele
      return [point]
    })
  )
}

/** Route name: the document title, falling back to the name of the placemark holding the track. */
function readName(doc: Document): string {
  const docName = doc.querySelector('Document > name')?.textContent?.trim()
  if (docName) return docName

  const geometry = doc.querySelector('LineString') ?? doc.getElementsByTagNameNS('*', 'Track')[0]
  const trackPlacemark = geometry?.closest('Placemark')
  return trackPlacemark?.querySelector(':scope > name')?.textContent?.trim() ?? ''
}

function buildGpx(segments: KmlPoint[][], waypoints: KmlWaypoint[], name: string): string {
  const trksegs = segments
    .map(
      (seg) =>
        `    <trkseg>\n${seg
          .map((p) =>
            p.ele !== undefined
              ? `      <trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele></trkpt>`
              : `      <trkpt lat="${p.lat}" lon="${p.lon}"/>`
          )
          .join('\n')}\n    </trkseg>`
    )
    .join('\n')

  const wpts = waypoints
    .map((w) =>
      w.name
        ? `  <wpt lat="${w.lat}" lon="${w.lon}"><name>${escapeXml(w.name)}</name></wpt>`
        : `  <wpt lat="${w.lat}" lon="${w.lon}"/>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Veshka">
${wpts ? `${wpts}\n` : ''}  <trk>
${name ? `    <name>${escapeXml(name)}</name>\n` : ''}${trksegs}
  </trk>
</gpx>`
}
