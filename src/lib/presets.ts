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
const EXTENSION_SIZES = [16, 32, 48, 128]

/** 쉼표·공백으로 구분한 크기 문자열을 정수 목록(중복 제거, 1~1024)으로 바꾼다 */
export function parseSizes(text: string): number[] {
  return parseSizesDetailed(text).sizes
}

/** parseSizes 와 같되, 버려진 토큰도 함께 돌려준다(화면에서 무시한 값을 알리기 위해) */
export function parseSizesDetailed(text: string): { sizes: number[]; ignored: string[] } {
  const out = new Set<number>()
  const ignored: string[] = []
  for (const t of text.split(/[\s,]+/)) {
    if (!t) continue
    const n = Number(t)
    if (Number.isInteger(n) && n >= 1 && n <= MAX_CUSTOM_SIZE) out.add(n)
    else if (!ignored.includes(t)) ignored.push(t)
  }
  return { sizes: [...out].sort((a, b) => a - b), ignored }
}

/** 프리셋이 만드는 파일 수(진행률 분모) */
export function presetFileCount(id: PresetId, s: Settings): number {
  return id === 'extension' ? 5 : id === 'favicon' ? 4 : id === 'pwa' ? 5 : id === 'apple' ? 2 : s.customSizes.length
}

/** manifest.json 에 병합하는 조각(확장 프로그램) */
export function extensionSnippet(): string {
  const icons: Record<string, string> = {}
  for (const n of EXTENSION_SIZES) icons[String(n)] = `icon${n}.png`
  return JSON.stringify({ icons, action: { default_icon: icons } }, null, 2) + '\n'
}

/** manifest.webmanifest 에 병합하는 조각(PWA) */
export function pwaSnippet(): string {
  const icons: { src: string; sizes: string; type: string; purpose?: string }[] = []
  for (const n of [192, 512]) icons.push({ src: `icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })
  for (const n of [192, 512]) icons.push({ src: `icon-maskable-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'maskable' })
  return JSON.stringify({ icons }, null, 2) + '\n'
}

export function faviconSnippet(): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '',
  ].join('\n')
}

export function appleSnippet(): string {
  return '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
}

/** 화면에 보여 주는 붙여넣기용 조각(직접 지정 크기에는 없음) */
export const SNIPPETS: { id: PresetId; label: string; target: string; make: () => string }[] = [
  { id: 'extension', label: '확장 프로그램', target: 'manifest.json 에 병합', make: extensionSnippet },
  { id: 'pwa', label: 'PWA', target: 'manifest.webmanifest 에 병합', make: pwaSnippet },
  { id: 'favicon', label: 'Favicon', target: '<head> 에 붙여넣기', make: faviconSnippet },
  { id: 'apple', label: 'Apple touch', target: '<head> 에 붙여넣기', make: appleSnippet },
]

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
  onFile?: (path: string) => void | Promise<void>,
): Promise<PresetFile[]> {
  const files: PresetFile[] = []
  const add = async (path: string, data: Uint8Array | string) => {
    files.push({ path, data })
    await onFile?.(path)
  }
  const png = (size: number, mode: RenderMode = 'normal') => rasterize(buildSvg(node, s, size, mode), size)

  if (id === 'extension') {
    for (const n of EXTENSION_SIZES) await add(`extension/icon${n}.png`, await png(n))
    await add('extension/manifest-icons.json', extensionSnippet())
  } else if (id === 'favicon') {
    const p16 = await png(16)
    const p32 = await png(32)
    const p48 = await png(48)
    await add('favicon/favicon.ico', encodeIco([{ size: 16, png: p16 }, { size: 32, png: p32 }, { size: 48, png: p48 }]))
    await add('favicon/favicon-16x16.png', p16)
    await add('favicon/favicon-32x32.png', p32)
    await add('favicon/link-tags.html', faviconSnippet())
  } else if (id === 'pwa') {
    for (const n of [192, 512]) await add(`pwa/icon-${n}.png`, await png(n))
    for (const n of [192, 512]) await add(`pwa/icon-maskable-${n}.png`, await png(n, 'maskable'))
    await add('pwa/manifest-icons.json', pwaSnippet())
  } else if (id === 'apple') {
    await add('apple/apple-touch-icon.png', await png(180, 'apple'))
    await add('apple/link-tags.html', appleSnippet())
  } else {
    for (const n of s.customSizes) await add(`custom/icon-${n}.png`, await png(n))
  }
  return files
}

export const asBytes = (d: Uint8Array | string): Uint8Array => (typeof d === 'string' ? text(d) : d)

export function selectedPresets(sel: Selection): PresetId[] {
  return PRESET_INFO.map((p) => p.id).filter((id) => sel[id])
}
