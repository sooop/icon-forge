import type { RenderMode, Settings } from './types'

export type IconNode = [string, Record<string, string | number>][]

const MIN_STROKE_PX = 1.67 // postal 16px 에서 검증한 값: 2.5 * 16 / 24
const MAX_STROKE = 3.5
const MASKABLE_ICON_SIDE = 60 // 안전 영역(중앙 지름 80%) 안에 아이콘 사각형이 들어오는 한 변 %

/** 렌더링 크기에서 선이 MIN_STROKE_PX 아래로 가늘어지지 않도록 굵기를 올린다. iconSide 는 아이콘이 차지하는 한 변 % */
export function effectiveStroke(base: number, size: number, auto: boolean, iconSide = 100): number {
  if (!auto) return base
  return Math.min(MAX_STROKE, Math.max(base, (MIN_STROKE_PX * 24 * 100) / (size * iconSide)))
}

function attrs(a: Record<string, string | number>): string {
  return Object.entries(a)
    .filter(([k]) => k !== 'key')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ')
}

export function iconBody(node: IconNode): string {
  return node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')
}

/** 100x100 좌표계에서 배경과 아이콘을 그린 SVG 문자열을 만든다 */
export function buildSvg(node: IconNode, s: Settings, size: number, mode: RenderMode = 'normal'): string {
  const small = s.softenSmall && size <= 32
  let shape = s.bgShape
  let radius = s.bgRadius
  let padding = s.padding
  let bgColor = s.bgColor

  if (mode === 'apple') {
    // iOS 가 직접 모서리를 깎으므로 꽉 찬 불투명 사각형으로 만든다
    if (shape === 'none') bgColor = '#ffffff'
    shape = 'square'
    radius = 0
  } else if (mode === 'maskable') {
    if (shape === 'none') bgColor = '#ffffff'
    shape = 'square'
    radius = 0
  }

  const hasBg = shape !== 'none'
  let iconSide = hasBg ? 100 - padding * 2 : 100 - Math.min(padding, 40) * 2
  if (mode === 'maskable') iconSide = Math.min(iconSide, MASKABLE_ICON_SIDE)
  const offset = (100 - iconSide) / 2
  const scale = iconSide / 24
  const stroke = effectiveStroke(s.strokeWidth, size, s.autoStroke, iconSide)

  // 작은 크기에서는 그림자를 끄고 그라데이션 끝 색을 시작 색 쪽으로 당긴다
  // maskable·apple 은 꽉 찬 배경이라 그림자가 가장자리 틈을 만들므로 쓰지 않는다
  const shadow = s.shadow && !small && mode === 'normal'
  const gradient = s.bgGradient && hasBg
  const c2 = small && gradient ? mix(bgColor, s.bgColor2, 0.4) : s.bgColor2

  const defs: string[] = []
  if (gradient) {
    defs.push(
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgColor}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`,
    )
  }
  if (shadow) {
    defs.push(
      `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#000" flood-opacity="0.35"/></filter>`,
    )
  }

  let bg = ''
  if (hasBg) {
    const fill = gradient ? 'url(#g)' : bgColor
    const filter = shadow ? ' filter="url(#sh)"' : ''
    // 그림자가 잘리지 않도록 배경을 약간 안쪽에 그린다
    const inset = shadow ? 4 : 0
    const box = 100 - inset * 2
    bg =
      shape === 'circle'
        ? `<circle cx="50" cy="50" r="${box / 2}" fill="${fill}"${filter}/>`
        : `<rect x="${inset}" y="${inset}" width="${box}" height="${box}" rx="${(box * radius) / 100}" fill="${fill}"${filter}/>`
  }

  const iconFilter = shadow && !hasBg ? ' filter="url(#sh)"' : ''
  const body = iconBody(node)
  const iconG = `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${s.strokeColor}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${iconFilter}>${body}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${bg}${iconG}</svg>`
}

function hex(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** a 쪽으로 t 만큼 b 를 섞는다(t=0 → a) */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const f = (x: number, y: number) => Math.round(x + (y - x) * t)
  return '#' + [f(r1, r2), f(g1, g2), f(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')
}
