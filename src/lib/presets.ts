import { encodeIco } from './ico'
import { buildSvg, type IconNode } from './svg'
import type { PresetId, RenderMode, Selection, Settings } from './types'

export type Rasterize = (svg: string, size: number) => Promise<Uint8Array>

export const PRESET_INFO: { id: PresetId; label: string; desc: string }[] = [
  { id: 'extension', label: '브라우저 확장', desc: '16 / 32 / 48 / 128 PNG + manifest icons 조각' },
  { id: 'favicon', label: 'Favicon', desc: 'favicon.ico(16·32·48) + 16 / 32 PNG + <link> 조각' },
  { id: 'pwa', label: 'PWA', desc: '192 / 512 + maskable 192 / 512 + manifest icons 조각' },
  { id: 'apple', label: 'Apple touch', desc: '180 PNG, 불투명 배경 강제' },
  { id: 'custom', label: '직접 지정 크기', desc: '입력한 크기마다 PNG' },
]

export const MAX_CUSTOM_SIZE = 1024

/** 쉼표·공백으로 구분한 크기 문자열을 정수 목록(중복 제거, 1~1024)으로 바꾼다 */
export function parseSizes(text: string): number[] {
  const out = new Set<number>()
  for (const t of text.split(/[\s,]+/)) {
    const n = Number(t)
    if (Number.isInteger(n) && n >= 1 && n <= MAX_CUSTOM_SIZE) out.add(n)
  }
  return [...out].sort((a, b) => a - b)
}

export interface PresetFile {
  path: string
  data: Uint8Array | string
}

const enc = new TextEncoder()
const text = (s: string) => enc.encode(s)

export async function buildPresetFiles(
  id: PresetId,
  node: IconNode,
  s: Settings,
  rasterize: Rasterize,
): Promise<PresetFile[]> {
  const png = (size: number, mode: RenderMode = 'normal') => rasterize(buildSvg(node, s, size, mode), size)
  const files: PresetFile[] = []

  if (id === 'extension') {
    const sizes = [16, 32, 48, 128]
    const icons: Record<string, string> = {}
    for (const n of sizes) {
      files.push({ path: `extension/icon${n}.png`, data: await png(n) })
      icons[String(n)] = `icon${n}.png`
    }
    files.push({ path: 'extension/manifest-icons.json', data: JSON.stringify({ icons, action: { default_icon: icons } }, null, 2) + '\n' })
  } else if (id === 'favicon') {
    const p16 = await png(16)
    const p32 = await png(32)
    const p48 = await png(48)
    files.push({ path: 'favicon/favicon.ico', data: encodeIco([{ size: 16, png: p16 }, { size: 32, png: p32 }, { size: 48, png: p48 }]) })
    files.push({ path: 'favicon/favicon-16x16.png', data: p16 })
    files.push({ path: 'favicon/favicon-32x32.png', data: p32 })
    files.push({
      path: 'favicon/link-tags.html',
      data: [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '',
      ].join('\n'),
    })
  } else if (id === 'pwa') {
    const icons: { src: string; sizes: string; type: string; purpose?: string }[] = []
    for (const n of [192, 512]) {
      files.push({ path: `pwa/icon-${n}.png`, data: await png(n) })
      icons.push({ src: `icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })
    }
    for (const n of [192, 512]) {
      files.push({ path: `pwa/icon-maskable-${n}.png`, data: await png(n, 'maskable') })
      icons.push({ src: `icon-maskable-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'maskable' })
    }
    files.push({ path: 'pwa/manifest-icons.json', data: JSON.stringify({ icons }, null, 2) + '\n' })
  } else if (id === 'apple') {
    files.push({ path: 'apple/apple-touch-icon.png', data: await png(180, 'apple') })
    files.push({ path: 'apple/link-tags.html', data: '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' })
  } else {
    for (const n of s.customSizes) files.push({ path: `custom/icon-${n}.png`, data: await png(n) })
  }
  return files
}

export const asBytes = (d: Uint8Array | string): Uint8Array => (typeof d === 'string' ? text(d) : d)

export function selectedPresets(sel: Selection): PresetId[] {
  return PRESET_INFO.map((p) => p.id).filter((id) => sel[id])
}
