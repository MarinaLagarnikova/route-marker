import type { GeoPoint } from '../model'

/**
 * Compute the bearing in degrees (0=North, 90=East) from point A to point B.
 */
function bearing(a: GeoPoint, b: GeoPoint): number {
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Creates a DOM element for a compass-arrow start marker.
 * The arrow points in the direction of the route's first segment.
 */
export function createStartArrowMarker(track: GeoPoint[], onClick?: () => void): HTMLElement {
  const dir = track.length >= 2 ? bearing(track[0], track[1]) : 0

  const el = document.createElement('div')
  el.style.cssText = [
    'width:32px', 'height:32px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer',
  ].join(';')

  // Arrow SVG rotated to route direction
  el.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
         style="transform:rotate(${dir}deg); transform-origin: center;">
      <circle cx="16" cy="16" r="14" fill="#FF7A29" stroke="white" stroke-width="2"/>
      <path d="M16 8 L20 20 L16 17 L12 20 Z" fill="white"/>
    </svg>
  `

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onClick()
    })
  }

  return el
}
