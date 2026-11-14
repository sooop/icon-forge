import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { IconEntry } from '../lib/icons'
import { Ico } from './Ico'
import { IconGlyph } from './IconGlyph'

const GAP = 4
const CELL_MIN = 92
const ROW_H = 80
const STRIDE = ROW_H + GAP
const OVERSCAN = 2

interface Props {
  entries: IconEntry[]
  selected: string
  favorites: ReadonlySet<string>
  /** 값이 바뀔 때마다 선택 항목을 격자 가운데로 스크롤한다 */
  revealTick: number
  onPick: (key: string) => void
  onToggleFav: (key: string) => void
  onLeaveTop?: () => void
}

/** 행 단위 가상화 격자. 화면에 보이는 행만 그린다 */
export const IconGrid = memo(function IconGrid({ entries, selected, favorites, revealTick, onPick, onToggleFav, onLeaveTop }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [top, setTop] = useState(0)
  const [focusIdx, setFocusIdx] = useState(0)
  const pending = useRef<number | null>(null)
  const raf = useRef(0)

  useLayoutEffect(() => {
    const el = box.current!
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = Math.max(1, Math.floor((size.w + GAP) / (CELL_MIN + GAP)))
  const rows = Math.ceil(entries.length / cols)
  const indexOf = useMemo(() => new Map(entries.map((e, i) => [e.key, i])), [entries])

  const scrollTo = useCallback((y: number) => {
    const el = box.current
    if (el) el.scrollTop = Math.max(0, y)
  }, [])

  // 검색 결과가 바뀌면 맨 위부터 본다
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    scrollTo(0)
    setFocusIdx(0)
  }, [entries, scrollTo])

  // 선택 항목으로 이동(처음 그릴 때와 revealTick 이 바뀔 때)
  const doneTick = useRef(-1)
  useEffect(() => {
    if (!size.h || doneTick.current === revealTick) return
    doneTick.current = revealTick
    const i = indexOf.get(selected)
    if (i === undefined) return
    setFocusIdx(i)
    const row = Math.floor(i / cols)
    scrollTo(row * STRIDE - (size.h - ROW_H) / 2)
  }, [revealTick, size.h, indexOf, selected, cols, scrollTo])

  const startRow = Math.max(0, Math.floor(top / STRIDE) - OVERSCAN)
  const endRow = Math.min(rows, Math.ceil((top + size.h) / STRIDE) + OVERSCAN)
  const from = startRow * cols
  const to = Math.min(entries.length, endRow * cols)
  const tabIdx = Math.min(Math.max(focusIdx, from), Math.max(from, to - 1))
  const cellW = size.w ? (size.w - GAP * (cols - 1)) / cols : CELL_MIN

  const moveTo = (i: number) => {
    const idx = Math.min(entries.length - 1, Math.max(0, i))
    pending.current = idx
    setFocusIdx(idx)
    const row = Math.floor(idx / cols)
    const y = row * STRIDE
    const el = box.current!
    if (y < el.scrollTop) scrollTo(y)
    else if (y + ROW_H > el.scrollTop + size.h) scrollTo(y + ROW_H - size.h)
  }

  useEffect(() => {
    if (pending.current === null) return
    const b = box.current?.querySelector<HTMLElement>(`[data-idx="${pending.current}"]`)
    if (b) {
      b.focus({ preventScroll: true })
      pending.current = null
    }
  })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    const attr = t.closest('[data-idx]')?.getAttribute('data-idx')
    if (attr == null || e.altKey || e.ctrlKey || e.metaKey) return
    const i = Number(attr)
    const page = Math.max(1, Math.floor(size.h / STRIDE)) * cols
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight': next = i + 1; break
      case 'ArrowLeft': next = i - 1; break
      case 'ArrowDown': next = i + cols < entries.length ? i + cols : i; break
      case 'ArrowUp':
        if (i < cols) { e.preventDefault(); onLeaveTop?.(); return }
        next = i - cols
        break
      case 'Home': next = i - (i % cols); break
      case 'End': next = Math.min(entries.length - 1, i - (i % cols) + cols - 1); break
      case 'PageDown': next = i + page; break
      case 'PageUp': next = i - page; break
      case 'f': case 'F': e.preventDefault(); onToggleFav(entries[i].key); return
      default: return
    }
    e.preventDefault()
    moveTo(next)
  }

  const items: React.ReactNode[] = []
  for (let i = from; i < to; i++) {
    const e = entries[i]
    const fav = favorites.has(e.key)
    items.push(
      <div key={e.key} className="cell-wrap">
        <button
          type="button"
          className="cell"
          data-idx={i}
          tabIndex={i === tabIdx ? 0 : -1}
          aria-pressed={e.key === selected}
          aria-label={e.label}
          title={`${e.label}${fav ? ' · 즐겨찾기' : ''}`}
          onClick={() => { setFocusIdx(i); onPick(e.key) }}
        >
          <IconGlyph k={e.key} />
          <small>{e.label}</small>
        </button>
        <button
          type="button"
          className={`star${fav ? ' on' : ''}`}
          tabIndex={-1}
          aria-pressed={fav}
          aria-label={`${e.label} 즐겨찾기`}
          title="즐겨찾기 (격자에서 F 키)"
          onClick={() => onToggleFav(e.key)}
        >
          <Ico n="star" />
        </button>
      </div>,
    )
  }

  return (
    <div
      ref={box}
      className="grid-scroll"
      onScroll={(e) => {
        const y = e.currentTarget.scrollTop
        cancelAnimationFrame(raf.current)
        raf.current = requestAnimationFrame(() => setTop(y))
      }}
      onKeyDown={onKeyDown}
    >
      <div style={{ height: rows * STRIDE - (rows ? GAP : 0), position: 'relative' }}>
        <div
          className="grid"
          role="group"
          aria-label="아이콘 목록"
          style={{
            transform: `translateY(${startRow * STRIDE}px)`,
            gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
            gridAutoRows: `${ROW_H}px`,
          }}
        >
          {items}
        </div>
      </div>
    </div>
  )
})
