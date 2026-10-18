import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from './defaults'
import { MAX_CUSTOM_SIZE } from './presets'
import type { BgShape, Selection, Settings } from './types'

const KEY = 'icon-forge:v1'
const FORMAT = 'icon-forge'

export interface State {
  settings: Settings
  selection: Selection
}

const SHAPES: BgShape[] = ['none', 'square', 'circle']
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** 저장값·불러온 JSON 은 신뢰할 수 없으므로 필드마다 검증하고 틀리면 기본값을 쓴다 */
export function sanitize(raw: unknown): State {
  const r = obj(raw)
  const s = obj(r.settings)
  const sel = obj(r.selection)
  const d = DEFAULT_SETTINGS
  const ds = DEFAULT_SELECTION
  const sizes = Array.isArray(s.customSizes)
    ? [...new Set(s.customSizes.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= MAX_CUSTOM_SIZE))]
    : d.customSizes
  const settings: Settings = {
    icon: typeof s.icon === 'string' && s.icon ? s.icon : d.icon,
    strokeColor: isColor(s.strokeColor) ? s.strokeColor : d.strokeColor,
    strokeWidth: num(s.strokeWidth, 0.5, 3.5, d.strokeWidth),
    autoStroke: bool(s.autoStroke, d.autoStroke),
    bgShape: SHAPES.includes(s.bgShape as BgShape) ? (s.bgShape as BgShape) : d.bgShape,
    bgColor: isColor(s.bgColor) ? s.bgColor : d.bgColor,
    bgColor2: isColor(s.bgColor2) ? s.bgColor2 : d.bgColor2,
    bgGradient: bool(s.bgGradient, d.bgGradient),
    bgRadius: num(s.bgRadius, 0, 50, d.bgRadius),
    padding: num(s.padding, 0, 40, d.padding),
    shadow: bool(s.shadow, d.shadow),
    softenSmall: bool(s.softenSmall, d.softenSmall),
    customSizes: sizes.sort((a, b) => a - b),
  }
  const selection: Selection = {
    extension: bool(sel.extension, ds.extension),
    favicon: bool(sel.favicon, ds.favicon),
    pwa: bool(sel.pwa, ds.pwa),
    apple: bool(sel.apple, ds.apple),
    custom: bool(sel.custom, ds.custom),
  }
  return { settings, selection }
}

export function settingsToJson(settings: Settings, selection: Selection): string {
  return JSON.stringify({ format: FORMAT, version: 1, settings, selection }, null, 2) + '\n'
}

/** 내보낸 JSON 을 파싱한다. 이 앱의 형식이 아니면 null */
export function parseSettingsJson(text: string): State | null {
  try {
    const data = JSON.parse(text)
    if (!data || data.format !== FORMAT) return null
    return sanitize(data)
  } catch {
    return null
  }
}

export function loadState(): State {
  try {
    const t = localStorage.getItem(KEY)
    if (t) return sanitize(JSON.parse(t))
  } catch {
    // 저장소 접근이 막힌 환경에서는 기본값으로 시작한다
  }
  return { settings: DEFAULT_SETTINGS, selection: DEFAULT_SELECTION }
}

export function saveState(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 용량 초과·차단은 무시
  }
}
