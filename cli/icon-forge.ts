/**
 * Icon Forge CLI — 웹앱과 같은 렌더 로직(src/lib)으로 터미널에서 아이콘을 만든다.
 * 래스터화는 resvg(WASM)를 쓰므로 브라우저·네이티브 모듈 없이 Node 18+ 만 있으면 된다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import wasmBytes from '@resvg/resvg-wasm/index_bg.wasm'
import licenseText from '../node_modules/lucide/LICENSE'
import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from '../src/lib/defaults'
import { canonicalKey, getIconNode, searchIcons } from '../src/lib/icons'
import { asBytes, buildPresetFiles, parseSizesDetailed, PRESET_INFO } from '../src/lib/presets'
import { parseSettingsJson, sanitize, settingsToJson } from '../src/lib/storage'
import { buildSvg } from '../src/lib/svg'
import type { PresetId, Selection, Settings } from '../src/lib/types'

const HELP = `icon-forge — Lucide 아이콘으로 확장·Favicon·PWA·Apple touch 아이콘 생성

사용법
  icon-forge [generate] --icon <이름> [옵션]     아이콘 파일 생성(기본 동작)
  icon-forge search <검색어> [--limit 30]        Lucide 아이콘 이름 검색
  icon-forge --help

아이콘·색
  --icon <이름>          Lucide 이름(kebab-case 또는 PascalCase, 별칭 허용). 기본 ${DEFAULT_SETTINGS.icon}
  --color <#rrggbb>      선(아이콘) 색. 기본 ${DEFAULT_SETTINGS.strokeColor}
  --stroke <0.5~3.5>     24px 기준 선 굵기. 기본 ${DEFAULT_SETTINGS.strokeWidth}
  --no-auto-stroke       작은 크기 선 굵기 자동 보정 끄기

배경
  --bg <none|square|circle>   기본 none(투명)
  --bg-color <#rrggbb>        배경색. 기본 ${DEFAULT_SETTINGS.bgColor}
  --gradient [#rrggbb]        그라데이션 켜기(끝 색 선택, 기본 ${DEFAULT_SETTINGS.bgColor2})
  --radius <0~50>             square 모서리 둥글기(%). 기본 ${DEFAULT_SETTINGS.bgRadius}
  --padding <0~40>            배경 안쪽 여백(%). 기본 ${DEFAULT_SETTINGS.padding}
  --shadow                    그림자(32px 이하에서는 자동으로 끔)
  --no-soften                 작은 크기 그림자·그라데이션 약화 끄기

출력
  --presets <목록>       extension,favicon,pwa,apple,custom 쉼표 구분 또는 all. 기본 extension
  --sizes <목록>         custom 프리셋 크기(예: 24,64,256). 지정하면 custom 이 자동 포함된다
  --out <폴더>           출력 폴더. 기본 ./icons
  --svg-only             PNG 대신 icon.svg 만 만든다
  --config <파일>        웹앱이 내보낸 icon-forge.json 을 기본값으로 읽는다(옵션이 우선)
  --json                 결과를 JSON 으로 출력한다(스크립트·에이전트용)

예
  icon-forge --icon rocket --color "#ffffff" --bg circle --bg-color "#2563eb" --gradient "#7c3aed" --presets pwa,favicon --out public
`

const PRESET_IDS = PRESET_INFO.map((p) => p.id)

class CliError extends Error {}

const isColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

function color(name: string, v: string): string {
  let c = v.startsWith('#') ? v : `#${v}`
  if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + [...c.slice(1)].map((x) => x + x).join('') // #fff → #ffffff
  if (!isColor(c)) throw new CliError(`--${name}: #rrggbb 형식이어야 합니다 (받은 값: ${v})`)
  return c.toLowerCase()
}

function number(name: string, v: string, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) throw new CliError(`--${name}: ${min}~${max} 사이 숫자여야 합니다 (받은 값: ${v})`)
  return n
}

/** 사용자가 쓴 이름을 Lucide 대표 키(PascalCase)로 바꾼다. 없으면 비슷한 후보를 알려 준다 */
function resolveIcon(input: string): string {
  const pascal = input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
  const key = canonicalKey(input) ?? canonicalKey(pascal)
  if (key) return key
  const hint = searchIcons(input).slice(0, 8).map((e) => e.label)
  throw new CliError(`Lucide 에 '${input}' 아이콘이 없습니다.` + (hint.length ? ` 비슷한 이름: ${hint.join(', ')}` : ' `icon-forge search <검색어>` 로 찾아 보세요.'))
}

let wasmReady: Promise<void> | null = null
async function rasterize(svg: string, size: number): Promise<Uint8Array> {
  wasmReady ??= initWasm(wasmBytes)
  await wasmReady
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

function write(root: string, rel: string, data: Uint8Array | string): void {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, data)
}

async function generate(argv: string[]): Promise<void> {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      icon: { type: 'string' },
      color: { type: 'string' },
      stroke: { type: 'string' },
      'no-auto-stroke': { type: 'boolean' },
      bg: { type: 'string' },
      'bg-color': { type: 'string' },
      gradient: { type: 'string' },
      radius: { type: 'string' },
      padding: { type: 'string' },
      shadow: { type: 'boolean' },
      'no-soften': { type: 'boolean' },
      presets: { type: 'string' },
      sizes: { type: 'string' },
      out: { type: 'string' },
      'svg-only': { type: 'boolean' },
      config: { type: 'string' },
      json: { type: 'boolean' },
    },
    strict: true,
  })

  // 기본값 → --config → 명령행 옵션 순으로 덮어쓴다
  let settings: Settings = { ...DEFAULT_SETTINGS }
  let selection: Selection = { ...DEFAULT_SELECTION }
  if (v.config) {
    const st = parseSettingsJson(readFileSync(resolve(v.config), 'utf8'))
    if (!st) throw new CliError(`--config: Icon Forge 가 내보낸 icon-forge.json 형식이 아닙니다 (${v.config})`)
    settings = st.settings
    selection = st.selection
  }
  if (v.icon) settings.icon = resolveIcon(v.icon)
  else if (!v.config) throw new CliError('--icon 이 필요합니다. 이름을 모르면 `icon-forge search <검색어>` 로 찾으세요.')
  if (v.color) settings.strokeColor = color('color', v.color)
  if (v.stroke) settings.strokeWidth = number('stroke', v.stroke, 0.5, 3.5)
  if (v['no-auto-stroke']) settings.autoStroke = false
  if (v.bg) {
    if (!['none', 'square', 'circle'].includes(v.bg)) throw new CliError(`--bg: none, square, circle 중 하나여야 합니다 (받은 값: ${v.bg})`)
    settings.bgShape = v.bg as Settings['bgShape']
  }
  if (v['bg-color']) {
    settings.bgColor = color('bg-color', v['bg-color'])
    if (!v.bg && settings.bgShape === 'none') settings.bgShape = 'square' // 배경색을 줬는데 투명으로 남기면 헷갈린다
  }
  if (v.gradient !== undefined) {
    settings.bgGradient = true
    if (v.gradient) settings.bgColor2 = color('gradient', v.gradient)
    if (settings.bgShape === 'none') settings.bgShape = 'square'
  }
  // 배경이 있는데 여백을 안 줬으면 아이콘이 배경 가장자리에 붙지 않도록 형태별 기본 여백을 쓴다(웹앱 기본은 0)
  if (!v.padding && !v.config && settings.bgShape !== 'none') settings.padding = settings.bgShape === 'circle' ? 24 : 20
  if (v.radius) settings.bgRadius = number('radius', v.radius, 0, 50)
  if (v.padding) settings.padding = number('padding', v.padding, 0, 40)
  if (v.shadow) settings.shadow = true
  if (v['no-soften']) settings.softenSmall = false

  const ignored: string[] = []
  if (v.sizes) {
    const r = parseSizesDetailed(v.sizes)
    if (!r.sizes.length) throw new CliError(`--sizes: 1~1024 사이 정수 목록이어야 합니다 (받은 값: ${v.sizes})`)
    settings.customSizes = r.sizes
    ignored.push(...r.ignored)
  }
  if (v.presets) {
    const names = v.presets === 'all' ? PRESET_IDS : v.presets.split(/[\s,]+/).filter(Boolean)
    const bad = names.filter((n) => !PRESET_IDS.includes(n as PresetId))
    if (bad.length) throw new CliError(`--presets: 알 수 없는 프리셋 ${bad.join(', ')} (가능: ${PRESET_IDS.join(', ')}, all)`)
    selection = { extension: false, favicon: false, pwa: false, apple: false, custom: false }
    for (const n of names) selection[n as PresetId] = true
  }
  if (v.sizes) selection.custom = true
  // sanitize 로 웹앱과 같은 범위 검증을 한 번 더 통과시킨다
  const checked = sanitize({ settings, selection })
  settings = checked.settings
  selection = checked.selection

  const node = getIconNode(settings.icon)
  if (!node) throw new CliError(`Lucide 에 '${settings.icon}' 아이콘이 없습니다`)

  const out = resolve(v.out ?? 'icons')
  const files: { path: string; bytes: number }[] = []
  const put = (rel: string, data: Uint8Array | string) => {
    const b = asBytes(data)
    write(out, rel, b)
    files.push({ path: join(out, rel), bytes: b.length })
  }

  if (!v['svg-only']) {
    for (const id of PRESET_IDS.filter((p) => selection[p])) {
      for (const f of await buildPresetFiles(id, node, settings, rasterize)) put(f.path, f.data)
    }
  }
  put('icon.svg', buildSvg(node, settings, 512, 'normal') + '\n')
  put('icon-forge.json', settingsToJson(settings, selection))
  put('LICENSE-lucide.txt', licenseText)

  if (v.json) {
    console.log(JSON.stringify({ icon: settings.icon, out, files, ignoredSizes: ignored }, null, 2))
  } else {
    console.log(`아이콘 '${settings.icon}' → ${out}`)
    for (const f of files) console.log(`  ${f.path}  (${f.bytes.toLocaleString()} B)`)
    if (ignored.length) console.log(`무시한 크기 값: ${ignored.join(', ')}`)
  }
}

function search(argv: string[]): void {
  const { values: v, positionals } = parseArgs({
    args: argv,
    options: { limit: { type: 'string' }, json: { type: 'boolean' } },
    allowPositionals: true,
    strict: true,
  })
  const limit = v.limit ? number('limit', v.limit, 1, 1000) : 30
  const hits = searchIcons(positionals.join(' '))
  const shown = hits.slice(0, limit)
  if (v.json) {
    console.log(JSON.stringify({ total: hits.length, icons: shown.map((e) => ({ name: e.label, aliases: e.aliases })) }, null, 2))
    return
  }
  for (const e of shown) console.log(e.aliases.length ? `${e.label}  (${e.aliases.join(', ')})` : e.label)
  console.log(`-- ${hits.length}개 중 ${shown.length}개 표시`)
}

async function main(): Promise<void> {
  const [first, ...rest] = process.argv.slice(2)
  if (!first || first === '--help' || first === '-h' || first === 'help') return void console.log(HELP)
  if (first === 'search') return search(rest)
  await generate(first === 'generate' ? rest : [first, ...rest])
}

main().catch((e: unknown) => {
  if (e instanceof CliError || (e instanceof TypeError && 'code' in e)) {
    console.error(`오류: ${(e as Error).message}`)
  } else {
    console.error(e)
  }
  process.exit(1)
})
