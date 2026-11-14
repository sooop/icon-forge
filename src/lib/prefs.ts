import type { Backdrop, Prefs } from './types'

export const MAX_RECENT_ICONS = 16
export const MAX_FAVORITES = 64
export const MAX_RECENT_COLORS = 8

export const DEFAULT_PREFS: Prefs = {
  backdrop: 'light',
  maskGuide: false,
  recentIcons: [],
  favorites: [],
  recentColors: [],
}

const BACKDROPS: Backdrop[] = ['light', 'dark', 'checker']
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const strList = (v: unknown, max: number, ok: (s: string) => boolean = (s) => s.length > 0 && s.length < 80): string[] => {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    if (typeof x === 'string' && ok(x) && !out.includes(x)) out.push(x)
    if (out.length >= max) break
  }
  return out
}

/** 저장된 prefs 는 신뢰하지 않고 필드마다 검증한다(없으면 기본값) */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    backdrop: BACKDROPS.includes(r.backdrop as Backdrop) ? (r.backdrop as Backdrop) : DEFAULT_PREFS.backdrop,
    maskGuide: typeof r.maskGuide === 'boolean' ? r.maskGuide : DEFAULT_PREFS.maskGuide,
    recentIcons: strList(r.recentIcons, MAX_RECENT_ICONS),
    favorites: strList(r.favorites, MAX_FAVORITES),
    recentColors: strList(Array.isArray(r.recentColors) ? r.recentColors.map((c) => (typeof c === 'string' ? c.toLowerCase() : c)) : [], MAX_RECENT_COLORS, isColor),
  }
}

/** 가장 최근 항목을 맨 앞에 두고 중복을 없애며 max 개로 자른다 */
export function pushRecent(list: string[], item: string, max: number): string[] {
  return [item, ...list.filter((x) => x !== item)].slice(0, max)
}

export function toggleIn(list: string[], item: string, max = MAX_FAVORITES): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [item, ...list].slice(0, max)
}
