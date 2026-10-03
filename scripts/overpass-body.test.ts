import { describe, it, expect } from 'vitest'
import { parseOverpassBody } from './overpass-body'

describe('разбор ответа Overpass', () => {
  it('достаёт элементы из нормального ответа', () => {
    const raw = JSON.stringify({ elements: [{ type: 'node', id: 1 }] })
    expect(parseOverpassBody(raw)).toEqual([{ type: 'node', id: 1 }])
  })

  it('ответ без элементов — это пусто, а не ошибка', () => {
    expect(parseOverpassBody(JSON.stringify({ version: 0.6 }))).toEqual([])
  })

  // Отлуп по лимиту приходит текстом, а не JSON. Без этого он выглядел в логе
  // как «Overpass молчит», и причина простоя оставалась невидимой
  it('отлуп по лимиту называет причину своими словами', () => {
    const raw = '<html><body><p>Error: runtime error: Query run out of memory</p></body></html>'
    expect(() => parseOverpassBody(raw))
      .toThrow(/Query run out of memory/)
  })

  it('пустой ответ тоже объясняется, а не молчит', () => {
    expect(() => parseOverpassBody('')).toThrow(/пустой ответ/)
  })
})
