import { parseGpx } from '@/shared/lib/gpx'
import type { GpxData } from '@/shared/lib/gpx'
import { unzipKmz, kmlToGpx } from '@/shared/lib/kmz'

export interface ParsedTrackFile {
  data: GpxData
  /** Always GPX XML: what gets hashed, stored and shared, whatever the source format was. */
  xml: string
}

/** ZIP local file header magic — `PK\x03\x04`. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

/**
 * Reads a track file and normalises it to GPX.
 *
 * Format is detected by content rather than by extension: exported tracks get
 * renamed often, and a KMZ saved as `.gpx` should still open.
 */
export async function parseTrackFile(file: File): Promise<ParsedTrackFile> {
  const buffer = await file.arrayBuffer()

  if (hasZipSignature(buffer)) {
    const kml = await unzipKmz(buffer)
    return fromGpxXml(kmlToGpx(kml))
  }

  const text = new TextDecoder('utf-8').decode(buffer)

  if (text.includes('<kml')) return fromGpxXml(kmlToGpx(text))
  if (text.includes('<gpx')) return fromGpxXml(text)

  throw new Error('Неподдерживаемый формат файла — нужен GPX, KML или KMZ')
}

function fromGpxXml(xml: string): ParsedTrackFile {
  return { data: parseGpx(xml), xml }
}

function hasZipSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < ZIP_SIGNATURE.length) return false
  const head = new Uint8Array(buffer, 0, ZIP_SIGNATURE.length)
  return ZIP_SIGNATURE.every((byte, i) => head[i] === byte)
}
