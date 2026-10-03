/**
 * Разбор ответа Overpass.
 *
 * Отдельно от запроса, потому что отказы приходят не кодом, а телом: лимит
 * обращений, нехватка памяти и перегрузка возвращаются текстом или HTML. Пока
 * всё это сваливалось в общий `catch`, лог говорил «Overpass молчит», и
 * пятнадцатиминутная лестница повторов выглядела как сбой сети.
 */

export interface OverpassElementLike {
  type: string
  id: number
  [key: string]: unknown
}

/** Первая осмысленная строка тела — в ней Overpass и объясняет отказ. */
function firstMeaningfulLine(raw: string): string {
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 200)
}

export function parseOverpassBody(raw: string): OverpassElementLike[] {
  if (raw.trim() === '') throw new Error('Overpass вернул пустой ответ')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Overpass ответил не JSON: ${firstMeaningfulLine(raw)}`)
  }

  const elements = (parsed as { elements?: OverpassElementLike[] }).elements
  return elements ?? []
}
