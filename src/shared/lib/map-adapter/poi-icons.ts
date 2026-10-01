import type { PoiCategory } from '@/shared/lib/poi'
import {
  MARKER_BORDER, MARKER_SHADOW, MARKER_SHADOW_COLOR, MARKER_SHADOW_SIGMA,
} from './marker-style'

/**
 * Пиктограммы категорий для слоя «Интересное». Рисуются в SVG и отдаются карте
 * растром: MapLibre умеет только растровые icon-image.
 *
 * Метка — капля остриём вниз, оранжевая. Оранжевый #FF7A29 — единственный цвет
 * приложения, до сих пор живший только в логотипе: им слой отделяется от чёрного
 * маршрута, и два слоя не спорят за внимание.
 */
/** Оранжевый метки. Им же красится кружок в шторке объекта — одна семья. */
export const POI_ACCENT = '#FF7A29'
const BADGE_FILL = POI_ACCENT
const GLYPH_COLOR = '#ffffff'
/** Светлый кант, чтобы метка не сливалась с тёмной подложкой. */
const BADGE_HALO = '#ffffff'

/**
 * Геометрия капли: голова — круг r16 с центром (20,20), остриё в (20,50).
 * Касательные из острия приходят ровно в (6.46,28.53) и (33.54,28.53).
 */
const DROP_PATH = 'M6.46 28.53A16 16 0 1 1 33.54 28.53L20 50Z'
const DROP_W = 40
const DROP_H = 52
/** Поля вокруг фигуры под тень, в тех же единицах: иначе её срежет край растра. */
const DROP_PAD = 8

/** Ширина самой капли на экране, CSS-пиксели. Картинка шире неё на поля. */
const PIN_W = 35
/** Сколько CSS-пикселей в одной единице viewBox. */
const UNIT = PIN_W / DROP_W

const VIEW_W = DROP_W + DROP_PAD * 2
const VIEW_H = DROP_H + DROP_PAD * 2
const IMG_W = VIEW_W * UNIT
const IMG_H = VIEW_H * UNIT

/**
 * Остриё капли лежит на DROP_PAD выше нижнего края картинки. При
 * `icon-anchor: bottom` к точке прижимается именно край, поэтому метку надо
 * опустить на величину поля — иначе она указывает выше объекта.
 */
export const POI_PIN_ANCHOR_OFFSET: [number, number] = [0, DROP_PAD * UNIT]

/**
 * Штрихи в системе координат 24×24, как у lucide. Их делят метка на карте и
 * кружок в шторке объекта: значок категории должен быть один и тот же.
 */
export const GLYPHS: Record<PoiCategory, string> = {
  // три волны — lucide `waves-horizontal`
  water: [
    '<path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/>',
    '<path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/>',
    '<path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/>',
  ].join(''),
  // палатка — lucide `tent`. Силуэт открытый: сплошной треугольник занят
  // предупреждением, и рядом они не должны перекликаться
  camp: [
    '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/>',
    '<path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
  ].join(''),
  // восклицательный знак в треугольнике — lucide `triangle-alert`
  caution: [
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>',
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  ].join(''),
  // лист — lucide `leaf`
  nature: [
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>',
    '<path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  ].join(''),
  // звезда — lucide `star`
  heritage: [
    '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756',
    'a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56',
    'l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139',
    'a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755',
    'a2.122 2.122 0 0 0 1.597-1.16z"/>',
  ].join(''),
  // лавка под маркизой — lucide `store`
  supply: [
    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>',
    '<path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0',
    ' 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10',
    'a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>',
    '<path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  ].join(''),
}

export const POI_ICON_IDS: Record<PoiCategory, string> = {
  water: 'poi-water',
  camp: 'poi-camp',
  caution: 'poi-caution',
  nature: 'poi-nature',
  heritage: 'poi-heritage',
  supply: 'poi-supply',
}

function iconSvg(category: PoiCategory): string {
  // Тень задана в CSS-пикселях на всё приложение — переводим в единицы viewBox
  const shadowY = (MARKER_SHADOW.offsetY / UNIT).toFixed(2)
  const shadowSigma = (MARKER_SHADOW_SIGMA / UNIT).toFixed(2)
  // Обводка центрована по контуру: снаружи видна половина, поэтому вдвое шире
  const haloWidth = ((MARKER_BORDER * 2) / UNIT).toFixed(2)

  // Растр вдвое крупнее экранного размера — отдаётся с pixelRatio 2
  return [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` width="${IMG_W * 2}" height="${IMG_H * 2}"`,
    ` viewBox="${-DROP_PAD} ${-DROP_PAD} ${VIEW_W} ${VIEW_H}">`,
    '<filter id="s" x="-50%" y="-50%" width="200%" height="200%">',
    `<feDropShadow dx="0" dy="${shadowY}" stdDeviation="${shadowSigma}"`,
    ` flood-color="#000" flood-opacity="${MARKER_SHADOW.opacity}"/>`,
    '</filter>',
    `<g filter="url(#s)">`,
    `<path d="${DROP_PATH}" fill="none" stroke="${BADGE_HALO}" stroke-width="${haloWidth}" stroke-linejoin="round"/>`,
    `<path d="${DROP_PATH}" fill="${BADGE_FILL}" stroke-linejoin="round"/>`,
    '</g>',
    // Глиф 24×24 по центру головы капли, а не всей фигуры
    `<g transform="translate(9.8 9.8) scale(0.85)" fill="none" stroke="${GLYPH_COLOR}"`,
    ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
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

/**
 * Размер плашки на экране, CSS-пиксели. Раньше здесь было 48, а слой ужимал их
 * до 36 через `icon-size: 0.75` — вместе с ними ужималась бы и тень. Теперь
 * размер запечён как есть, а слой рисует картинку один к одному.
 */
const PHOTO_PIN_SIZE = 36
const PHOTO_PIN_RADIUS = 6
/** Поле под тень. Сама плашка не растёт, растёт только холст вокруг неё. */
const PHOTO_PIN_PAD = 6

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
  const pad = PHOTO_PIN_PAD * scale
  const canvasSize = size + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const radius = PHOTO_PIN_RADIUS * scale
  const border = MARKER_BORDER * scale

  // Тень кладём только под белую карточку: на снимок внутри она не нужна
  ctx.save()
  ctx.shadowColor = MARKER_SHADOW_COLOR
  ctx.shadowBlur = MARKER_SHADOW.blur * scale
  ctx.shadowOffsetY = MARKER_SHADOW.offsetY * scale
  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, pad, pad, size, size, radius)
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundedRect(
    ctx, pad + border, pad + border,
    size - border * 2, size - border * 2, radius - border / 2,
  )
  ctx.clip()

  const side = Math.min(photo.width, photo.height)
  ctx.drawImage(
    photo,
    (photo.width - side) / 2, (photo.height - side) / 2, side, side,
    pad + border, pad + border, size - border * 2, size - border * 2,
  )
  ctx.restore()

  if (map.hasImage(id)) return true
  map.addImage(id, ctx.getImageData(0, 0, canvasSize, canvasSize), { pixelRatio: scale })
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
