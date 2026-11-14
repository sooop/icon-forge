import { icons } from 'lucide'
import type { IconNode } from './svg'

export interface IconEntry {
  /** lucide `icons` 의 PascalCase 키(표시·저장에 쓰는 대표 이름) */
  key: string
  /** 화면 표시용 kebab-case */
  label: string
  /** 같은 그림을 가리키는 다른 이름들(검색용) */
  aliases: string[]
}

const collator = new Intl.Collator('en')
const table = icons as unknown as Record<string, IconNode>

export const kebab = (k: string) =>
  k.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase()

const primaryOf = new Map<string, string>()

/** lucide 는 별칭마다 같은 노드를 따로 내보내므로 그림이 같은 것끼리 묶는다 */
function buildEntries(): IconEntry[] {
  const groups = new Map<string, string[]>()
  for (const key of Object.keys(table)) {
    const sig = JSON.stringify(table[key])
    const g = groups.get(sig)
    if (g) g.push(key)
    else groups.set(sig, [key])
  }
  const out: IconEntry[] = []
  for (const keys of groups.values()) {
    const primary = keys.reduce((a, b) => (b.length < a.length ? b : a))
    for (const k of keys) primaryOf.set(k, primary)
    out.push({ key: primary, label: kebab(primary), aliases: keys.filter((k) => k !== primary).map(kebab) })
  }
  return out.sort((a, b) => collator.compare(a.label, b.label))
}

export const ICON_ENTRIES = buildEntries()


/** 별칭 키도 같은 그림의 대표 키로 바꾼다. 라이브러리에 없는 키는 null */
export function canonicalKey(key: string): string | null {
  if (!Object.hasOwn(table, key)) return null
  return primaryOf.get(key) ?? key
}

export function getIconNode(key: string): IconNode | null {
  return Object.hasOwn(table, key) ? table[key] : null
}

export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '-')
  if (!q) return ICON_ENTRIES
  return ICON_ENTRIES.filter((e) => e.label.includes(q) || e.aliases.some((a) => a.includes(q)))
}

/** 설정의 아이콘 키를 검증한다. 별칭이면 대표 키로 바꾸고, 라이브러리에 없으면 fallback 으로 되돌리고 원래 키를 missing 으로 알린다 */
export function fixIcon<T extends { icon: string }>(s: T, fallback: string): { settings: T; missing: string | null } {
  const k = canonicalKey(s.icon)
  if (k === null) return { settings: { ...s, icon: fallback }, missing: s.icon }
  return { settings: k === s.icon ? s : { ...s, icon: k }, missing: null }
}
