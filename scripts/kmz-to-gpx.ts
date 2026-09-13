#!/usr/bin/env tsx
/**
 * Converts a Maps.me / Organic Maps KMZ (or a bare KML) into GPX for the route library.
 * Usage: npx tsx scripts/kmz-to-gpx.ts ./Треки/2026-09-12T152955Z.kmz [Название маршрута]
 *
 * Writes GPX to stdout, stats to stderr. Uses the same kmlToGpx/unzipKmz the app
 * uses, so the published file matches exactly what an in-app upload would produce.
 */

import { readFileSync } from 'fs'
import { JSDOM } from 'jsdom'

// kmlToGpx relies on browser globals; provide them before importing it.
const dom = new JSDOM()
globalThis.DOMParser = dom.window.DOMParser
globalThis.Element = dom.window.Element
globalThis.Document = dom.window.Document

const { kmlToGpx } = await import('../src/shared/lib/kmz/kml.ts')
const { unzipKmz } = await import('../src/shared/lib/kmz/zip.ts')

const filePath = process.argv[2]
const routeName = process.argv[3]

if (!filePath) {
  console.error('Usage: npx tsx scripts/kmz-to-gpx.ts <file.kmz|file.kml> [route name]')
  process.exit(1)
}

const buf = readFileSync(filePath)
const isZip = buf[0] === 0x50 && buf[1] === 0x4b

const kml = isZip
  ? await unzipKmz(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
  : buf.toString('utf-8')

let gpx = kmlToGpx(kml)

if (routeName) {
  const escaped = routeName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  gpx = gpx.includes('<name>')
    ? gpx.replace(/<name>[\s\S]*?<\/name>/, `<name>${escaped}</name>`)
    : gpx.replace('  <trk>\n', `  <trk>\n    <name>${escaped}</name>\n`)
}

const points = (gpx.match(/<trkpt /g) ?? []).length
const withEle = (gpx.match(/<ele>/g) ?? []).length
console.error(`Точек: ${points}, из них с высотой: ${withEle}`)

console.log(gpx)
