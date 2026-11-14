import { memo, useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { getIconNode, ICON_ENTRIES, kebab, searchIcons } from '../lib/icons'
import { Ico } from './Ico'
import { IconGlyph } from './IconGlyph'
import { IconGrid } from './IconGrid'

interface Props {
  selected: string
  favorites: string[]
  recent: string[]
  revealTick: number
  searchRef: RefObject<HTMLInputElement | null>
  onPick: (key: string, track: boolean) => void
  onToggleFav: (key: string) => void
}

function StripRow({ label, keys, selected, onPick }: { label: string; keys: string[]; selected: string; onPick: (key: string) => void }) {
  if (keys.length === 0) return null
  return (
    <div className="strip" role="group" aria-label={label}>
      <span className="strip-label">{label}</span>
      <div className="strip-items">
        {keys.map((k) => (
          <button key={k} type="button" className="strip-btn" aria-pressed={k === selected} aria-label={kebab(k)} title={kebab(k)} onClick={() => onPick(k)}>
            <IconGlyph k={k} />
          </button>
        ))}
      </div>
    </div>
  )
}

/** 설정이 바뀌어도 다시 그려지지 않도록 App 과 분리한 아이콘 선택 영역 */
export const IconPicker = memo(function IconPicker({ selected, favorites, recent, revealTick, searchRef, onPick, onToggleFav }: Props) {
  const [query, setQuery] = useState('')
  const [bump, setBump] = useState(0)
  const results = useMemo(() => searchIcons(query), [query])
  const favSet = useMemo(() => new Set(favorites), [favorites])
  const gridBox = useRef<HTMLDivElement>(null)
  const isFav = favSet.has(selected)
  const known = getIconNode(selected) !== null
  const pickTracked = useCallback((k: string) => onPick(k, true), [onPick])
  const pickQuiet = useCallback((k: string) => onPick(k, false), [onPick])

  const setQ = (v: string) => {
    setQuery(v)
    if (!v.trim()) setBump((b) => b + 1)
  }
  const focusGrid = () => gridBox.current?.querySelector<HTMLElement>('.cell[tabindex="0"]')?.focus()

  return (
    <section className="card picker" aria-label="아이콘 선택">
      <div className="picker-head">
        <div className="current">
          <span className="current-glyph" aria-hidden="true">{known && <IconGlyph k={selected} />}</span>
          <div className="current-text">
            <span className="muted-label">선택한 아이콘</span>
            <strong className="current-name" title={selected}>{kebab(selected)}</strong>
          </div>
          <button
            type="button"
            className={`icon-btn star-btn${isFav ? ' on' : ''}`}
            aria-pressed={isFav}
            aria-label="선택한 아이콘 즐겨찾기"
            title={isFav ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기'}
            onClick={() => onToggleFav(selected)}
          >
            <Ico n="star" />
          </button>
        </div>
        <label className="search-box">
          <Ico n="search" />
          <input
            ref={searchRef}
            type="search"
            aria-label="아이콘 이름 검색"
            placeholder={`이름으로 검색 (${ICON_ENTRIES.length.toLocaleString('ko-KR')}개)`}
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) { e.preventDefault(); setQ('') }
              else if (e.key === 'ArrowDown') { e.preventDefault(); focusGrid() }
              else if (e.key === 'Enter' && results.length > 0) { onPick(results[0].key, true) }
            }}
          />
          <kbd className="kbd" aria-hidden="true">/</kbd>
        </label>
        <StripRow label="즐겨찾기" keys={favorites} selected={selected} onPick={pickQuiet} />
        <StripRow label="최근" keys={recent} selected={selected} onPick={pickQuiet} />
      </div>
      <div className="grid-area" ref={gridBox}>
        <IconGrid
          entries={results}
          selected={selected}
          favorites={favSet}
          revealTick={revealTick + bump}
          onPick={pickTracked}
          onToggleFav={onToggleFav}
          onLeaveTop={() => searchRef.current?.focus()}
        />
        {results.length === 0 && <p className="empty">“{query.trim()}” 검색 결과가 없습니다.</p>}
      </div>
    </section>
  )
})
