/**
 * Minimal read-only ZIP reader for KMZ files — no external dependencies.
 *
 * A KMZ is a ZIP archive holding a `doc.kml`. We only need to locate that one
 * entry and inflate it, so this implements just the central-directory walk plus
 * the two compression methods archivers actually use for KML: stored and deflate.
 */

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_FILE_SIGNATURE = 0x02014b50
const LOCAL_FILE_SIGNATURE = 0x04034b50

/** ZIP comment is a 16-bit length, so the EOCD starts at most 22 + 65535 bytes from the end. */
const MAX_EOCD_SEARCH = 22 + 0xffff

const METHOD_STORED = 0
const METHOD_DEFLATE = 8

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  localHeaderOffset: number
}

/** Extracts the KML document out of a KMZ archive and returns it as text. */
export async function unzipKmz(buffer: ArrayBuffer): Promise<string> {
  const view = new DataView(buffer)
  const entries = readCentralDirectory(view)

  const entry =
    entries.find((e) => e.name.toLowerCase().endsWith('doc.kml')) ??
    entries.find((e) => e.name.toLowerCase().endsWith('.kml'))

  if (!entry) {
    throw new Error('В KMZ-архиве не найден KML-файл с маршрутом')
  }

  const bytes = await inflateEntry(view, entry)
  return new TextDecoder('utf-8').decode(bytes)
}

function readCentralDirectory(view: DataView): ZipEntry[] {
  const eocd = findEocdOffset(view)
  const entryCount = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)

  const entries: ZipEntry[] = []
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_FILE_SIGNATURE) {
      break
    }

    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)

    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      name: decodeName(view, offset + 46, nameLength),
      localHeaderOffset: view.getUint32(offset + 42, true),
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

/** Scans backwards from the end of the file for the End Of Central Directory record. */
function findEocdOffset(view: DataView): number {
  const searchStart = Math.max(0, view.byteLength - MAX_EOCD_SEARCH)
  for (let offset = view.byteLength - 22; offset >= searchStart; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset
  }
  throw new Error('Файл не является KMZ-архивом (повреждён или это другой формат)')
}

function decodeName(view: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length)
  return new TextDecoder('utf-8').decode(bytes)
}

async function inflateEntry(view: DataView, entry: ZipEntry): Promise<Uint8Array> {
  const header = entry.localHeaderOffset
  if (header + 30 > view.byteLength || view.getUint32(header, true) !== LOCAL_FILE_SIGNATURE) {
    throw new Error('KMZ-архив повреждён: не удалось прочитать содержимое')
  }

  const nameLength = view.getUint16(header + 26, true)
  const extraLength = view.getUint16(header + 28, true)
  const dataStart = header + 30 + nameLength + extraLength

  const data = new Uint8Array(
    view.buffer,
    view.byteOffset + dataStart,
    Math.min(entry.compressedSize, view.byteLength - dataStart)
  )

  if (entry.method === METHOD_STORED) return data
  if (entry.method === METHOD_DEFLATE) return inflateRaw(data)

  throw new Error(`KMZ-архив использует неподдерживаемое сжатие (метод ${entry.method})`)
}

/** Raw DEFLATE via the platform's DecompressionStream — no bundled inflate implementation. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Браузер не поддерживает распаковку KMZ — загрузите файл в формате GPX')
  }

  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  // Copied into a standalone buffer: `data` is a view over the whole archive,
  // and DecompressionStream only accepts an ArrayBuffer-backed view.
  const source = new Uint8Array(data)
  // Not awaited: the writer only settles once the reader below drains the stream.
  void writer.write(source).then(() => writer.close())

  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }

  const result = new Uint8Array(total)
  let cursor = 0
  for (const chunk of chunks) {
    result.set(chunk, cursor)
    cursor += chunk.byteLength
  }
  return result
}
