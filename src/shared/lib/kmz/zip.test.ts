import { describe, it, expect } from 'vitest'
import { unzipKmz } from './zip'
import {
  DEFLATED_KMZ,
  STORED_KMZ,
  NAMED_KMZ,
  NO_KML_KMZ,
  fixtureBuffer,
} from './__fixtures__'

describe('unzipKmz', () => {
  it('extracts doc.kml from a deflate-compressed archive', async () => {
    const kml = await unzipKmz(fixtureBuffer(DEFLATED_KMZ))

    expect(kml).toContain('<name>Поход на Таганай</name>')
    expect(kml).toContain('59.80,55.30,600')
  })

  it('extracts an entry stored without compression', async () => {
    const kml = await unzipKmz(fixtureBuffer(STORED_KMZ))

    expect(kml).toContain('<name>Поход на Таганай</name>')
  })

  it('finds the kml entry even when it is not named doc.kml', async () => {
    const kml = await unzipKmz(fixtureBuffer(NAMED_KMZ))

    expect(kml).toContain('<name>Поход на Таганай</name>')
  })

  it('throws a clear error when the archive contains no kml', async () => {
    await expect(unzipKmz(fixtureBuffer(NO_KML_KMZ))).rejects.toThrow(/KMZ/)
  })

  it('throws a clear error when the file is not a zip archive', async () => {
    const notZip = new TextEncoder().encode('<?xml version="1.0"?><gpx/>').buffer

    await expect(unzipKmz(notZip as ArrayBuffer)).rejects.toThrow(/KMZ|архив/)
  })
})
