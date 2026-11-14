import { memo } from 'react'
import { getIconNode } from '../lib/icons'
import { iconBody } from '../lib/svg'

const bodies = new Map<string, string>()

/** 아이콘 하나의 SVG 본문. 키마다 한 번만 문자열을 만든다 */
function bodyOf(key: string): string | null {
  let b = bodies.get(key)
  if (b === undefined) {
    const node = getIconNode(key)
    if (!node) return null
    b = iconBody(node)
    bodies.set(key, b)
  }
  return b
}

export const IconGlyph = memo(function IconGlyph({ k, className }: { k: string; className?: string }) {
  const body = bodyOf(k)
  if (body === null) return null
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }} />
  )
})
