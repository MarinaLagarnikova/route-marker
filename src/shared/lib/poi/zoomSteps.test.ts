import { describe, it, expect } from 'vitest'
import { CATEGORY_PRIORITY } from './types'
import { POI_ZOOM_STEPS, PHOTO_MIN_ZOOM, maxPriorityAtZoom } from './zoomSteps'
import type { PoiCategory } from './types'

/** Зум, на котором маршрут открывается после fitBounds (Звенигород — около 11.7). */
const OVERVIEW_ZOOM = 12

/** Категории, видимые на этом зуме. */
function visibleAt(zoom: number): PoiCategory[] {
  const limit = maxPriorityAtZoom(zoom)
  return (Object.keys(CATEGORY_PRIORITY) as PoiCategory[])
    .filter((category) => CATEGORY_PRIORITY[category] <= limit)
    .sort()
}

describe('ступени слоя по зуму', () => {
  // Маршрут открывается после fitBounds примерно на 11.7. Если на этом зуме слой
  // пуст, тап по кнопке слоя не даёт ничего видимого — кнопка кажется сломанной
  it('на обзорном зуме показывает первую ступень', () => {
    expect(visibleAt(11)).toEqual(['camp', 'caution', 'water'])
    expect(visibleAt(12)).toEqual(['camp', 'caution', 'water'])
  })

  it('первая ступень — только то, что решает в походе', () => {
    expect(visibleAt(13)).toEqual(['camp', 'caution', 'water'])
    expect(visibleAt(14)).toEqual(['camp', 'caution', 'water'])
  })

  it('вторая ступень добавляет остальное', () => {
    expect(visibleAt(15)).toEqual(['camp', 'caution', 'heritage', 'nature', 'supply', 'water'])
  })

  it('выше последней ступени состав больше не меняется', () => {
    expect(visibleAt(18)).toEqual(visibleAt(15))
  })

  // Снимки — самое интересное на слое, прятать их глубже объектов неправильно:
  // ступенью ниже до них пришлось бы домотать специально. Но и на обзоре им не
  // место, иначе плашки снова закроют трек
  it('фотографии приходят не раньше полного состава объектов', () => {
    const lastStep = POI_ZOOM_STEPS[POI_ZOOM_STEPS.length - 1].zoom
    expect(PHOTO_MIN_ZOOM).toBeGreaterThanOrEqual(lastStep)
  })

  // Плашка снимка крупная: на обзоре она закроет трек, ради которого всё затеяно
  it('на обзорном зуме фотографий нет', () => {
    expect(PHOTO_MIN_ZOOM).toBeGreaterThan(OVERVIEW_ZOOM)
  })

  it('ступени идут по возрастанию зума и порога', () => {
    for (let i = 1; i < POI_ZOOM_STEPS.length; i++) {
      expect(POI_ZOOM_STEPS[i].zoom).toBeGreaterThan(POI_ZOOM_STEPS[i - 1].zoom)
      expect(POI_ZOOM_STEPS[i].maxPriority).toBeGreaterThan(POI_ZOOM_STEPS[i - 1].maxPriority)
    }
  })

  // Фильтр карты сравнивает приоритет с порогом; нулевой порог обязан никого не пропустить
  it('последняя ступень пропускает каждую существующую категорию', () => {
    const heaviest = Math.max(...Object.values(CATEGORY_PRIORITY))
    expect(POI_ZOOM_STEPS[POI_ZOOM_STEPS.length - 1].maxPriority).toBeGreaterThanOrEqual(heaviest)
    expect(Math.min(...Object.values(CATEGORY_PRIORITY))).toBeGreaterThan(0)
  })

  // MapLibre пересчитывает ['zoom'] внутри filter только на целых зумах
  it('пороги заданы целыми числами', () => {
    for (const step of POI_ZOOM_STEPS) {
      expect(Number.isInteger(step.zoom), `ступень ${step.zoom}`).toBe(true)
    }
    expect(Number.isInteger(PHOTO_MIN_ZOOM)).toBe(true)
  })
})
