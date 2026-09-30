import type { PoiCategory } from '@/shared/lib/poi'

/**
 * Пиктограммы категорий для слоя «Интересное». Рисуются в SVG и отдаются карте
 * растром: MapLibre умеет только растровые icon-image.
 *
 * Цвета пока служебные — их определим при вёрстке, менять тут, в двух константах.
 */
const GLYPH_COLOR = '#171717'
const BADGE_FILL = '#ffffff'
const BADGE_STROKE = '#9ca3af'

/** Штрихи в системе координат 24×24, как у lucide. */
const GLYPHS: Record<PoiCategory, string> = {
  // капля
  water: '<path d="M12 3.5c3.2 3.4 5 6 5 8.4a5 5 0 0 1-10 0c0-2.4 1.8-5 5-8.4z"/>',
  // палатка
  camp: '<path d="M12 4 4 19h16L12 4z"/><path d="M12 10v9"/>',
  // восклицательный знак в треугольнике
  caution: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4"/><path d="M12 17.2v.2"/>',
  // гора с вершиной
  view: '<path d="M3 19h18L14 6l-4 7-2-2-5 8z"/>',
  // здание с колоннами
  heritage: '<path d="M4 10h16"/><path d="M12 3 4 7.5V10h16V7.5L12 3z"/><path d="M7 10v7M12 10v7M17 10v7"/><path d="M4 20h16"/>',
  // указатель на столбе
  signage: '<path d="M12 4v16"/><path d="M12 6h7l2 2.5L19 11h-7z"/>',
  // сумка
  supply: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
}

export const POI_ICON_IDS: Record<PoiCategory, string> = {
  water: 'poi-water',
  camp: 'poi-camp',
  caution: 'poi-caution',
  view: 'poi-view',
  heritage: 'poi-heritage',
  signage: 'poi-signage',
  supply: 'poi-supply',
}

function iconSvg(category: PoiCategory): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 28 28">',
    `<circle cx="14" cy="14" r="12" fill="${BADGE_FILL}" stroke="${BADGE_STROKE}" stroke-width="1.5"/>`,
    `<g transform="translate(5 5) scale(0.75)" fill="none" stroke="${GLYPH_COLOR}"`,
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    GLYPHS[category],
    '</g></svg>',
  ].join('')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось отрисовать значок слоя'))
    image.src = src
  })
}

interface ImageHost {
  hasImage(id: string): boolean
  addImage(id: string, image: HTMLImageElement | ImageData, options?: { pixelRatio?: number }): void
}

export async function registerPoiIcons(map: ImageHost): Promise<void> {
  const categories = Object.keys(POI_ICON_IDS) as PoiCategory[]
  await Promise.all(categories.map(async (category) => {
    const id = POI_ICON_IDS[category]
    if (map.hasImage(id)) return
    const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(category))}`)
    if (map.hasImage(id)) return
    map.addImage(id, image, { pixelRatio: 2 })
  }))
}

const PHOTO_PIN_SIZE = 48
const PHOTO_PIN_BORDER = 3

/**
 * Миниатюра фотографии как значок на карте: квадрат со скруглением и белой
 * рамкой, кадрируется по центру. Ошибка загрузки не должна ронять слой —
 * такое фото просто не появится на карте.
 */
export async function registerPhotoPin(map: ImageHost, id: string, src: string): Promise<boolean> {
  if (map.hasImage(id)) return true
  let photo: HTMLImageElement
  try {
    photo = await loadImage(src)
  } catch {
    return false
  }

  const scale = 2
  const size = PHOTO_PIN_SIZE * scale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const radius = 8 * scale
  const border = PHOTO_PIN_BORDER * scale

  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, 0, 0, size, size, radius)
  ctx.fill()

  ctx.save()
  roundedRect(ctx, border, border, size - border * 2, size - border * 2, radius - border / 2)
  ctx.clip()

  const side = Math.min(photo.width, photo.height)
  ctx.drawImage(
    photo,
    (photo.width - side) / 2, (photo.height - side) / 2, side, side,
    border, border, size - border * 2, size - border * 2,
  )
  ctx.restore()

  if (map.hasImage(id)) return true
  map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: scale })
  return true
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number, radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}
