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

const table = icons as unknown as Record<string, IconNode>

export const kebab = (k: string) =>
  k.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase()

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
    out.push({ key: primary, label: kebab(primary), aliases: keys.filter((k) => k !== primary).map(kebab) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export const ICON_ENTRIES = buildEntries()

export function getIconNode(key: string): IconNode | null {
  return table[key] ?? null
}

export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '-')
  if (!q) return ICON_ENTRIES
  return ICON_ENTRIES.filter((e) => e.label.includes(q) || e.aliases.some((a) => a.includes(q)))
}
