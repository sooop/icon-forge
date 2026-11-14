import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getIconNode } from '../lib/icons'
import { rasterize } from '../lib/raster'
import { buildSvg } from '../lib/svg'
import type { Backdrop, RenderMode, Settings } from '../lib/types'
import { Segmented, Switch } from './Controls'

interface Spec { size: number; mode: RenderMode }
const key = (sp: Spec) => `${sp.mode}-${sp.size}`

const SPECS: Spec[] = [
  { size: 16, mode: 'normal' },
  { size: 32, mode: 'normal' },
  { size: 48, mode: 'normal' },
  { size: 128, mode: 'normal' },
  { size: 128, mode: 'maskable' },
  { size: 256, mode: 'normal' },
  { size: 512, mode: 'normal' },
]

/** 렌더 설정이 바뀔 때만 모든 크기를 한 번에 다시 그린다(120ms 디바운스, 직전 그림은 새 그림이 나올 때까지 유지) */
function usePreviewImages(rs: Settings) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)
  const current = useRef<Record<string, string>>({})

  useEffect(() => {
    const node = getIconNode(rs.icon)
    if (!node) return
    let dead = false
    const made: Record<string, string> = {}
    const t = window.setTimeout(async () => {
      try {
        for (const sp of SPECS) {
          const png = await rasterize(buildSvg(node, rs, sp.size, sp.mode), sp.size)
          if (dead) return
          made[key(sp)] = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }))
        }
        const old = current.current
        current.current = made
        setUrls(made)
        setFailed(false)
        window.setTimeout(() => Object.values(old).forEach((u) => URL.revokeObjectURL(u)), 1500)
      } catch {
        if (!dead) setFailed(true)
        Object.values(made).forEach((u) => URL.revokeObjectURL(u))
      }
    }, 120)
    return () => {
      dead = true
      window.clearTimeout(t)
      if (current.current !== made) Object.values(made).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [rs])

  useEffect(() => () => Object.values(current.current).forEach((u) => URL.revokeObjectURL(u)), [])
  return { urls, failed }
}

function Pic({ url, size, zoom = 1, guide, className }: { url?: string; size: number; zoom?: number; guide?: boolean; className?: string }) {
  const d = size * zoom
  return (
    <span className={`pic${className ? ' ' + className : ''}`} style={{ width: d, height: d }}>
      {url && <img src={url} width={d} height={d} alt="" className={zoom > 1 ? 'zoomed' : undefined} />}
      {guide && <span className="mask-guide" />}
    </span>
  )
}

function Tile({ spec, url, backdrop, guide }: { spec: Spec; url?: string; backdrop: Backdrop; guide: boolean }) {
  const { size, mode } = spec
  // 작은 크기는 확대본과 실제 크기를 함께 보여 준다
  const zoom = size <= 16 ? 6 : size <= 32 ? 3 : size <= 48 ? 2 : 1
  const wide = size >= 256
  return (
    <figure className={`tile ${backdrop}${wide ? ' wide' : ''}`}>
      <div className="tile-imgs">
        <Pic url={url} size={size} zoom={zoom} guide={guide && size >= 48} />
        {zoom > 1 && <Pic url={url} size={size} />}
      </div>
      <figcaption>{size}px{mode !== 'normal' ? ` · ${mode}` : ''}</figcaption>
    </figure>
  )
}

interface Props {
  rs: Settings
  backdrop: Backdrop
  guide: boolean
  onBackdrop: (b: Backdrop) => void
  onGuide: (v: boolean) => void
}

export const PreviewPanel = memo(function PreviewPanel({ rs, backdrop, guide, onBackdrop, onGuide }: Props) {
  const { urls, failed } = usePreviewImages(rs)
  const u16 = urls['normal-16']
  const tiles = useMemo(() => SPECS, [])
  return (
    <div className="preview">
      <div className="preview-bar">
        <Segmented
          label="미리보기 배경"
          value={backdrop}
          onChange={onBackdrop}
          options={[{ value: 'light', label: '밝은 배경' }, { value: 'dark', label: '어두운 배경' }, { value: 'checker', label: '투명 격자' }]}
        />
        <Switch checked={guide} onChange={onGuide}>maskable 안전 영역</Switch>
      </div>

      <div className="compare" aria-label="16px 실제 크기 비교">
        {(['light', 'dark'] as const).map((b) => (
          <div key={b} className={`compare-box ${b}`}>
            <div className="compare-imgs">
              <Pic url={u16} size={16} />
              <Pic url={u16} size={16} zoom={4} />
            </div>
            <span className="compare-cap">{b === 'light' ? '밝은 배경' : '어두운 배경'} · 16px</span>
          </div>
        ))}
      </div>

      {failed && <p className="warn-text" role="alert">미리보기를 그리지 못했습니다.</p>}
      <div className="tiles">
        {tiles.map((sp) => <Tile key={key(sp)} spec={sp} url={urls[key(sp)]} backdrop={backdrop} guide={guide} />)}
      </div>
    </div>
  )
})
