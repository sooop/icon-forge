import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from './defaults'
import { encodeIco } from './ico'
import { getIconNode, searchIcons } from './icons'
import { parseSizes } from './presets'
import { parseSettingsJson, sanitize, settingsToJson } from './storage'
import { buildSvg, effectiveStroke } from './svg'
import { buildZip } from './zip'

const node = getIconNode('Mailbox')!
const fakePng = async (_svg: string, size: number) => new Uint8Array([0x89, 0x50, size & 255])

describe('effectiveStroke', () => {
  it('16px 는 2.5 로 굵어지고 32px 이상은 기본값을 유지한다(postal 규칙)', () => {
    expect(effectiveStroke(2, 16, true)).toBeCloseTo(2.5, 2)
    expect(effectiveStroke(2, 32, true)).toBe(2)
    expect(effectiveStroke(2, 128, true)).toBe(2)
  })
  it('자동 보정을 끄면 기본값 그대로', () => {
    expect(effectiveStroke(2, 16, false)).toBe(2)
  })
  it('배경 여백으로 아이콘이 작아지면 더 굵게 보정하되 상한을 넘지 않는다', () => {
    expect(effectiveStroke(2, 16, true, 60)).toBeGreaterThan(2.5)
    expect(effectiveStroke(2, 16, true, 10)).toBe(3.5)
  })
})

describe('buildSvg', () => {
  it('배경 없음: 아이콘 그룹만 있고 stroke 색이 들어간다', () => {
    const svg = buildSvg(node, DEFAULT_SETTINGS, 128)
    expect(svg).toContain('stroke="#d7141e"')
    expect(svg).not.toContain('<rect')
  })
  it('작은 크기에서는 그림자가 꺼지고, 큰 크기에서는 유지된다', () => {
    const s = { ...DEFAULT_SETTINGS, shadow: true, bgShape: 'square' as const }
    expect(buildSvg(node, s, 16)).not.toContain('feDropShadow')
    expect(buildSvg(node, s, 128)).toContain('feDropShadow')
    expect(buildSvg(node, { ...s, softenSmall: false }, 16)).toContain('feDropShadow')
  })
  it('maskable·apple 은 그림자를 쓰지 않는다', () => {
    const s = { ...DEFAULT_SETTINGS, shadow: true }
    expect(buildSvg(node, s, 192, 'maskable')).not.toContain('feDropShadow')
    expect(buildSvg(node, s, 180, 'apple')).not.toContain('feDropShadow')
  })
  it('apple 모드는 투명 배경이어도 불투명 흰 사각형을 깐다', () => {
    const svg = buildSvg(node, DEFAULT_SETTINGS, 180, 'apple')
    expect(svg).toContain('<rect')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('rx="0"')
  })
  it('maskable 모드는 아이콘을 안전 영역(60%) 안으로 줄인다', () => {
    const svg = buildSvg(node, { ...DEFAULT_SETTINGS, padding: 0 }, 192, 'maskable')
    expect(svg).toContain('scale(2.5)') // 60 / 24
  })
})

describe('encodeIco', () => {
  it('헤더·디렉터리·PNG 오프셋이 맞다', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([4, 5])
    const out = encodeIco([{ size: 16, png: a }, { size: 256, png: b }])
    const v = new DataView(out.buffer)
    expect(v.getUint16(2, true)).toBe(1)
    expect(v.getUint16(4, true)).toBe(2)
    expect(out[6]).toBe(16)
    expect(out[22]).toBe(0) // 256 은 0 으로 기록
    expect(v.getUint32(6 + 8, true)).toBe(3)
    expect(v.getUint32(6 + 12, true)).toBe(38)
    expect([...out.slice(38)]).toEqual([1, 2, 3, 4, 5])
  })
})

describe('parseSizes', () => {
  it('정수 1~1024 만 중복 없이 정렬해 받는다', () => {
    expect(parseSizes('64, 24 24 0 -3 2000 1.5 abc 256')).toEqual([24, 64, 256])
  })
})

describe('storage', () => {
  it('내보내기 → 불러오기가 왕복된다', () => {
    const st = { settings: { ...DEFAULT_SETTINGS, strokeColor: '#00ff00' }, selection: { ...DEFAULT_SELECTION, pwa: true } }
    const back = parseSettingsJson(settingsToJson(st.settings, st.selection))
    expect(back).toEqual(st)
  })
  it('다른 형식의 JSON·깨진 문자열은 거부한다', () => {
    expect(parseSettingsJson('{"a":1}')).toBeNull()
    expect(parseSettingsJson('not json')).toBeNull()
  })
  it('잘못된 값은 기본값으로 대체한다', () => {
    const r = sanitize({ settings: { strokeColor: 'red', padding: 999, bgShape: 'hex', customSizes: [0, 32, 5000] } })
    expect(r.settings.strokeColor).toBe(DEFAULT_SETTINGS.strokeColor)
    expect(r.settings.padding).toBe(40)
    expect(r.settings.bgShape).toBe('none')
    expect(r.settings.customSizes).toEqual([32])
  })
})

describe('icons', () => {
  it('별칭으로도 검색되고 같은 그림은 한 항목으로 묶인다', () => {
    expect(searchIcons('mailbox').some((e) => e.key === 'Mailbox')).toBe(true)
    const names = searchIcons('').map((e) => e.key)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('buildZip', () => {
  it('선택한 프리셋의 파일과 설정·라이선스가 들어간다', async () => {
    const sel = { extension: true, favicon: true, pwa: true, apple: true, custom: true }
    const s = { ...DEFAULT_SETTINGS, customSizes: [24, 64] }
    const files = unzipSync(await buildZip(node, s, sel, fakePng))
    const names = Object.keys(files).sort()
    expect(names).toEqual(
      [
        'LICENSE-lucide.txt',
        'apple/apple-touch-icon.png',
        'apple/link-tags.html',
        'custom/icon-24.png',
        'custom/icon-64.png',
        'extension/icon128.png',
        'extension/icon16.png',
        'extension/icon32.png',
        'extension/icon48.png',
        'extension/manifest-icons.json',
        'favicon/favicon-16x16.png',
        'favicon/favicon-32x32.png',
        'favicon/favicon.ico',
        'favicon/link-tags.html',
        'icon-forge.json',
        'pwa/icon-192.png',
        'pwa/icon-512.png',
        'pwa/icon-maskable-192.png',
        'pwa/icon-maskable-512.png',
        'pwa/manifest-icons.json',
      ].sort(),
    )
    const manifest = JSON.parse(new TextDecoder().decode(files['pwa/manifest-icons.json']))
    expect(manifest.icons).toHaveLength(4)
    expect(manifest.icons[3].purpose).toBe('maskable')
  })
  it('선택하지 않은 프리셋은 들어가지 않는다', async () => {
    const files = unzipSync(await buildZip(node, DEFAULT_SETTINGS, DEFAULT_SELECTION, fakePng))
    expect(Object.keys(files).some((n) => n.startsWith('pwa/'))).toBe(false)
  })
})
