import { unzipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from './defaults'
import { canonicalKey, fixIcon, getIconNode, searchIcons } from './icons'
import { DEFAULT_PREFS, MAX_RECENT_ICONS, pushRecent, sanitizePrefs, toggleIn } from './prefs'
import { appleSnippet, extensionSnippet, faviconSnippet, parseSizesDetailed, presetFileCount, pwaSnippet, SNIPPETS } from './presets'
import { loadPrefs, loadState, saveState, settingsToJson } from './storage'
import { buildIconSvg, buildZip, zipFileCount } from './zip'

const node = getIconNode('Mailbox')!
const fakePng = async (_svg: string, size: number) => new Uint8Array([0x89, 0x50, size & 255])
const all = { extension: true, favicon: true, pwa: true, apple: true, custom: true }

describe('parseSizesDetailed', () => {
  it('버려진 토큰을 알려 준다', () => {
    const r = parseSizesDetailed('24, abc 2000 0 64 abc 1.5')
    expect(r.sizes).toEqual([24, 64])
    expect(r.ignored).toEqual(['abc', '2000', '0', '1.5'])
  })
  it('빈 입력은 둘 다 비어 있다', () => {
    expect(parseSizesDetailed('  , ')).toEqual({ sizes: [], ignored: [] })
  })
})

describe('snippets', () => {
  it('zip 안의 조각 파일과 화면용 조각이 같은 내용이다', async () => {
    const files = unzipSync(await buildZip(node, DEFAULT_SETTINGS, { ...all, custom: false }, fakePng))
    const dec = (p: string) => new TextDecoder().decode(files[p])
    expect(dec('extension/manifest-icons.json')).toBe(extensionSnippet())
    expect(dec('pwa/manifest-icons.json')).toBe(pwaSnippet())
    expect(dec('favicon/link-tags.html')).toBe(faviconSnippet())
    expect(dec('apple/link-tags.html')).toBe(appleSnippet())
    expect(SNIPPETS.map((s) => s.id)).toEqual(['extension', 'pwa', 'favicon', 'apple'])
  })
  it('확장 조각은 icons 와 action.default_icon 을 가진다', () => {
    const j = JSON.parse(extensionSnippet())
    expect(Object.keys(j.icons)).toEqual(['16', '32', '48', '128'])
    expect(j.action.default_icon).toEqual(j.icons)
  })
})

describe('zip 진행·icon.svg', () => {
  it('진행 알림이 파일마다 한 번씩, done 은 1부터 total 까지', async () => {
    const s = { ...DEFAULT_SETTINGS, customSizes: [24, 64] }
    const seen: { done: number; total: number; path: string }[] = []
    const files = unzipSync(await buildZip(node, s, all, fakePng, (p) => seen.push(p)))
    const n = Object.keys(files).length
    expect(seen).toHaveLength(n)
    expect(zipFileCount(all, s)).toBe(n)
    expect(seen.map((p) => p.done)).toEqual(seen.map((_, i) => i + 1))
    expect(seen.every((p) => p.total === n)).toBe(true)
    expect(new Set(seen.map((p) => p.path))).toEqual(new Set(Object.keys(files)))
  })
  it('프리셋별 파일 수 계산이 실제와 맞다', async () => {
    for (const id of ['extension', 'favicon', 'pwa', 'apple', 'custom'] as const) {
      const sel = { extension: false, favicon: false, pwa: false, apple: false, custom: false, [id]: true }
      const n = Object.keys(unzipSync(await buildZip(node, DEFAULT_SETTINGS, sel, fakePng))).length - 3
      expect(presetFileCount(id, DEFAULT_SETTINGS)).toBe(n)
    }
  })
  it('icon.svg 에 현재 설정이 반영된다', async () => {
    const s = { ...DEFAULT_SETTINGS, strokeColor: '#123456', bgShape: 'circle' as const, bgColor: '#abcdef' }
    const files = unzipSync(await buildZip(node, s, DEFAULT_SELECTION, fakePng))
    const svg = new TextDecoder().decode(files['icon.svg'])
    expect(svg).toBe(buildIconSvg(node, s) + '\n')
    expect(svg).toContain('stroke="#123456"')
    expect(svg).toContain('<circle')
    expect(svg).toContain('fill="#abcdef"')
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  })
  it('PNG·ico 는 무압축으로 저장돼도 내용이 보존된다', async () => {
    const files = unzipSync(await buildZip(node, DEFAULT_SETTINGS, { ...DEFAULT_SELECTION, extension: false, favicon: true }, fakePng))
    expect([...files['favicon/favicon-16x16.png']]).toEqual([0x89, 0x50, 16])
  })
})

describe('prefs', () => {
  it('잘못된 값은 기본값으로, 목록은 중복·길이·형식을 걸러 낸다', () => {
    expect(sanitizePrefs(undefined)).toEqual(DEFAULT_PREFS)
    expect(sanitizePrefs('x')).toEqual(DEFAULT_PREFS)
    const p = sanitizePrefs({
      backdrop: 'neon',
      maskGuide: 'yes',
      recentIcons: ['A', 'A', 5, '', ...Array.from({ length: 30 }, (_, i) => `I${i}`)],
      recentColors: ['#AABBCC', 'red', '#aabbcc', '#112233', ...Array.from({ length: 20 }, (_, i) => `#0000${(10 + i).toString(16)}`)],
    })
    expect(p.backdrop).toBe('light')
    expect(p.maskGuide).toBe(false)
    expect(p.recentIcons).toHaveLength(MAX_RECENT_ICONS)
    expect(p.recentIcons.slice(0, 2)).toEqual(['A', 'I0'])
    expect(p.recentColors).toHaveLength(8)
    expect(p.recentColors.slice(0, 2)).toEqual(['#aabbcc', '#112233'])
  })
  it('유효한 값은 유지된다', () => {
    expect(sanitizePrefs({ backdrop: 'checker', maskGuide: true, favorites: ['Star'] })).toMatchObject({ backdrop: 'checker', maskGuide: true, favorites: ['Star'] })
  })
  it('pushRecent 는 앞에 두고 중복 제거 후 자르고, toggleIn 은 넣고 뺀다', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c'])
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
    expect(toggleIn(['a'], 'b')).toEqual(['b', 'a'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('icon-forge:v1 호환', () => {
  const mem = new Map<string, string>()
  const g = globalThis as { localStorage?: unknown }
  const install = () => {
    g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  }
  afterEach(() => {
    delete g.localStorage
    mem.clear()
  })
  it('prefs 가 없는 옛 저장값도 읽히고, prefs 를 덧붙여도 설정은 그대로다', () => {
    install()
    mem.set('icon-forge:v1', JSON.stringify({ settings: { icon: 'Star', strokeColor: '#00ff00' }, selection: { pwa: true } }))
    const st = loadState()
    expect(st.settings.icon).toBe('Star')
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    saveState(st, { ...DEFAULT_PREFS, backdrop: 'dark', favorites: ['Star'] })
    expect(loadState()).toEqual(st)
    expect(loadPrefs()).toMatchObject({ backdrop: 'dark', favorites: ['Star'] })
    expect(Object.keys(JSON.parse(mem.get('icon-forge:v1')!)).sort()).toEqual(['prefs', 'selection', 'settings'])
    // 내보내기 JSON 에는 prefs 가 들어가지 않는다
    expect(JSON.parse(settingsToJson(st.settings, st.selection)).prefs).toBeUndefined()
  })
  it('깨진 prefs 는 기본값', () => {
    install()
    mem.set('icon-forge:v1', JSON.stringify({ settings: {}, selection: {}, prefs: { backdrop: 7, recentIcons: 'x' } }))
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })
})

describe('fixIcon / canonicalKey', () => {
  it('없는 아이콘은 기본값으로 되돌리고 원래 키를 알린다', () => {
    const r = fixIcon({ ...DEFAULT_SETTINGS, icon: 'NoSuchIcon' }, 'Mailbox')
    expect(r.settings.icon).toBe('Mailbox')
    expect(r.missing).toBe('NoSuchIcon')
    expect(fixIcon({ icon: 'toString' }, 'Mailbox').missing).toBe('toString')
  })
  it('있는 아이콘은 그대로 둔다', () => {
    expect(fixIcon(DEFAULT_SETTINGS, 'Mailbox')).toEqual({ settings: DEFAULT_SETTINGS, missing: null })
  })
  it('별칭 키는 같은 그림의 대표 키로 바뀐다', () => {
    const entry = searchIcons('').find((e) => e.aliases.length > 0)!
    const a = entry.aliases[0]
    const aliasKey = a.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')
    // PascalCase 복원이 어긋나는 별칭(약어 등)은 건너뛰고, 복원되는 첫 별칭으로 확인한다
    const found = searchIcons('')
      .flatMap((e) => e.aliases.map((al) => ({ e, al })))
      .find(({ al }) => getIconNode(al.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')))
    expect(aliasKey).toBeTruthy()
    expect(found).toBeTruthy()
    const key = found!.al.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')
    expect(canonicalKey(key)).toBe(found!.e.key)
  })
  it('모든 대표 키는 자기 자신으로 수렴한다', () => {
    for (const e of searchIcons('')) expect(canonicalKey(e.key)).toBe(e.key)
  })
})
