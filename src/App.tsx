import { useEffect, useMemo, useRef, useState } from 'react'
import { getIconNode, searchIcons, ICON_ENTRIES } from './lib/icons'
import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from './lib/defaults'
import { parseSizes, PRESET_INFO } from './lib/presets'
import { rasterize } from './lib/raster'
import { effectiveStroke, buildSvg, iconBody } from './lib/svg'
import { loadState, parseSettingsJson, saveState, settingsToJson } from './lib/storage'
import { buildZip } from './lib/zip'
import type { PresetId, RenderMode, Selection, Settings } from './lib/types'

const PAGE = 120
const PREVIEW_SIZES = [16, 32, 48, 128]
type Backdrop = 'light' | 'dark' | 'checker'

function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Range({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <Field label={`${label} ${value}${unit}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  )
}

function IconGlyph({ k }: { k: string }) {
  const node = getIconNode(k)
  if (!node) return null
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconBody(node) }} />
  )
}

function Preview({ s, size, mode, backdrop }: { s: Settings; size: number; mode: RenderMode; backdrop: Backdrop }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const node = getIconNode(s.icon)
    if (!node) return
    let dead = false
    let made: string | null = null
    const t = setTimeout(async () => {
      try {
        const png = await rasterize(buildSvg(node, s, size, mode), size)
        if (dead) return
        made = URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' }))
        setUrl(made)
      } catch {
        if (!dead) setUrl(null)
      }
    }, 60)
    return () => {
      dead = true
      clearTimeout(t)
      if (made) URL.revokeObjectURL(made)
    }
  }, [s, size, mode])
  // 작은 크기는 4~8배로 확대해 픽셀을 보여 주고 실제 크기도 옆에 둔다
  const zoom = size <= 16 ? 6 : size <= 32 ? 3 : size <= 48 ? 2 : 1
  return (
    <figure className={`tile ${backdrop}`}>
      <div className="tile-imgs">
        {url && <img src={url} width={size * zoom} height={size * zoom} className="zoomed" alt="" />}
        {url && zoom > 1 && <img src={url} width={size} height={size} alt="" />}
      </div>
      <figcaption>{size}px{mode !== 'normal' ? ` · ${mode}` : ''}</figcaption>
    </figure>
  )
}

export default function App() {
  const initial = useMemo(loadState, [])
  const [s, setS] = useState<Settings>(initial.settings)
  const [sel, setSel] = useState<Selection>(initial.selection)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [backdrop, setBackdrop] = useState<Backdrop>('light')
  const [sizesText, setSizesText] = useState(initial.settings.customSizes.join(', '))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveState({ settings: s, selection: sel }), [s, sel])
  useEffect(() => setLimit(PAGE), [query])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }))
  const results = useMemo(() => searchIcons(query), [query])
  const node = getIconNode(s.icon)
  const anySelected = Object.values(sel).some(Boolean)
  const hasBg = s.bgShape !== 'none'
  const customOn = sel.custom && s.customSizes.length === 0

  async function onDownload() {
    if (!node || !anySelected || customOn) return
    setBusy(true)
    setMsg('')
    try {
      const zip = await buildZip(node, s, sel, rasterize)
      download(zip as BlobPart, `icons-${s.icon.toLowerCase()}.zip`, 'application/zip')
    } catch (e) {
      setMsg(`생성에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    const parsed = parseSettingsJson(await file.text())
    if (!parsed) return setMsg('icon-forge 설정 파일이 아닙니다.')
    setS(parsed.settings)
    setSel(parsed.selection)
    setSizesText(parsed.settings.customSizes.join(', '))
    setMsg('설정을 불러왔습니다.')
  }

  function reset() {
    setS(DEFAULT_SETTINGS)
    setSel(DEFAULT_SELECTION)
    setSizesText(DEFAULT_SETTINGS.customSizes.join(', '))
    setMsg('')
  }

  const stroke16 = effectiveStroke(s.strokeWidth, 16, s.autoStroke, hasBg ? 100 - s.padding * 2 : 100 - Math.min(s.padding, 40) * 2)

  return (
    <div className="app">
      <header>
        <h1>Icon Forge</h1>
        <p>Lucide 아이콘으로 브라우저 확장·Favicon·PWA 아이콘을 만들어 zip 으로 받습니다. 모든 처리는 이 브라우저 안에서만 이루어집니다.</p>
      </header>

      <main>
        <section className="panel">
          <h2>1. 아이콘</h2>
          <input className="search" placeholder={`이름으로 검색 (${ICON_ENTRIES.length}개)`} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid">
            {results.slice(0, limit).map((e) => (
              <button key={e.key} className={e.key === s.icon ? 'cell on' : 'cell'} title={e.label} onClick={() => set('icon', e.key)}>
                <IconGlyph k={e.key} />
                <small>{e.label}</small>
              </button>
            ))}
          </div>
          {results.length === 0 && <p className="hint">검색 결과가 없습니다.</p>}
          {results.length > limit && (
            <button className="link" onClick={() => setLimit((l) => l + PAGE)}>더 보기 ({results.length - limit}개 남음)</button>
          )}

          <h2>2. 모양</h2>
          <div className="row">
            <Field label="선 색"><input type="color" value={s.strokeColor} onChange={(e) => set('strokeColor', e.target.value)} /></Field>
            <Range label="선 굵기" value={s.strokeWidth} min={0.5} max={3.5} step={0.25} onChange={(v) => set('strokeWidth', v)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={s.autoStroke} onChange={(e) => set('autoStroke', e.target.checked)} />
            크기별 선 굵기 자동 보정 <small>(16px 에서 {Math.round(stroke16 * 100) / 100})</small>
          </label>

          <div className="row">
            <Field label="배경">
              <select value={s.bgShape} onChange={(e) => set('bgShape', e.target.value as Settings['bgShape'])}>
                <option value="none">없음(투명)</option>
                <option value="square">사각형</option>
                <option value="circle">원</option>
              </select>
            </Field>
            {hasBg && <Field label="배경 색"><input type="color" value={s.bgColor} onChange={(e) => set('bgColor', e.target.value)} /></Field>}
          </div>
          {hasBg && (
            <>
              <label className="check">
                <input type="checkbox" checked={s.bgGradient} onChange={(e) => set('bgGradient', e.target.checked)} />
                그라데이션
                {s.bgGradient && <input type="color" value={s.bgColor2} onChange={(e) => set('bgColor2', e.target.value)} />}
              </label>
              {s.bgShape === 'square' && <Range label="모서리 둥글기" value={s.bgRadius} min={0} max={50} unit="%" onChange={(v) => set('bgRadius', v)} />}
            </>
          )}
          <Range label="여백" value={s.padding} min={0} max={40} unit="%" onChange={(v) => set('padding', v)} />
          <label className="check">
            <input type="checkbox" checked={s.shadow} onChange={(e) => set('shadow', e.target.checked)} />
            그림자
          </label>
          <label className="check">
            <input type="checkbox" checked={s.softenSmall} onChange={(e) => set('softenSmall', e.target.checked)} />
            32px 이하에서 그림자 끄기·그라데이션 약화
          </label>
        </section>

        <section className="panel sticky">
          <h2>미리보기</h2>
          <div className="seg">
            {(['light', 'dark', 'checker'] as Backdrop[]).map((b) => (
              <button key={b} className={backdrop === b ? 'on' : ''} onClick={() => setBackdrop(b)}>
                {b === 'light' ? '밝은 배경' : b === 'dark' ? '어두운 배경' : '투명 격자'}
              </button>
            ))}
          </div>
          <div className="tiles">
            {PREVIEW_SIZES.map((n) => <Preview key={n} s={s} size={n} mode="normal" backdrop={backdrop} />)}
            <Preview s={s} size={128} mode="maskable" backdrop={backdrop} />
          </div>
          <p className="hint">작은 크기는 확대본과 실제 크기를 함께 보여 줍니다.</p>

          <h2>3. 출력</h2>
          <ul className="presets">
            {PRESET_INFO.map((p) => (
              <li key={p.id}>
                <label className="check">
                  <input type="checkbox" checked={sel[p.id as PresetId]} onChange={(e) => setSel((x) => ({ ...x, [p.id]: e.target.checked }))} />
                  <b>{p.label}</b>
                </label>
                <small>{p.desc}</small>
                {p.id === 'custom' && sel.custom && (
                  <input
                    className="search"
                    value={sizesText}
                    placeholder="예: 24, 64, 256 (1~1024)"
                    onChange={(e) => {
                      setSizesText(e.target.value)
                      set('customSizes', parseSizes(e.target.value))
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
          {customOn && <p className="warn">직접 지정 크기에 올바른 숫자를 입력해 주세요.</p>}

          <div className="actions">
            <button className="primary" disabled={busy || !anySelected || customOn} onClick={onDownload}>
              {busy ? '만드는 중…' : 'zip 다운로드'}
            </button>
            <button onClick={() => download(settingsToJson(s, sel), 'icon-forge.json', 'application/json')}>설정 내보내기</button>
            <button onClick={() => fileRef.current?.click()}>설정 불러오기</button>
            <button onClick={reset}>초기화</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          {msg && <p className="hint" role="status">{msg}</p>}
        </section>
      </main>
    </div>
  )
}
