import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SELECTION, DEFAULT_SETTINGS } from './lib/defaults'
import { fixIcon, getIconNode, kebab } from './lib/icons'
import { MAX_RECENT_COLORS, MAX_RECENT_ICONS, pushRecent, toggleIn } from './lib/prefs'
import { parseSizesDetailed, PRESET_INFO } from './lib/presets'
import { rasterize } from './lib/raster'
import { effectiveStroke } from './lib/svg'
import { loadPrefs, loadState, parseSettingsJson, saveState, settingsToJson } from './lib/storage'
import type { Backdrop, PresetId, Prefs, Selection, Settings } from './lib/types'
import { copyText, download } from './lib/util'
import { buildIconSvg, buildZip, type ZipProgress } from './lib/zip'
import { ColorField, Range, Segmented, Switch } from './ui/Controls'
import { Ico } from './ui/Ico'
import { IconPicker } from './ui/IconPicker'
import { PreviewPanel } from './ui/PreviewPanel'
import { Snippets } from './ui/Snippets'
import { Toasts, useToasts } from './ui/Toasts'

const THEME_KEY = 'icon-forge.theme'
const NO_SIZES: number[] = []

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'))
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => {
      let stored: string | null = null
      try { stored = localStorage.getItem(THEME_KEY) } catch { /* 저장소 차단 */ }
      if (stored === 'light' || stored === 'dark') return
      const t = m.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', t)
      setTheme(t)
    }
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  const toggle = useCallback(() => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* 저장소 차단 */ }
  }, [])
  return { theme, toggle }
}

function renderKey(s: Settings): string {
  return [s.icon, s.strokeColor, s.strokeWidth, s.autoStroke, s.bgShape, s.bgColor, s.bgColor2, s.bgGradient, s.bgRadius, s.padding, s.shadow, s.softenSmall].join('|')
}

const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export default function App() {
  const initial = useMemo(() => {
    const st = loadState()
    const fixed = fixIcon(st.settings, DEFAULT_SETTINGS.icon)
    return { settings: fixed.settings, selection: st.selection, missing: fixed.missing, prefs: loadPrefs() }
  }, [])
  const [s, setS] = useState<Settings>(initial.settings)
  const [sel, setSel] = useState<Selection>(initial.selection)
  const [prefs, setPrefs] = useState<Prefs>(initial.prefs)
  const [sizesText, setSizesText] = useState(initial.settings.customSizes.join(', '))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ZipProgress | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [revealTick, setRevealTick] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { toasts, push } = useToasts()
  const { theme, toggle } = useTheme()

  // 저장은 400ms 디바운스, 탭을 닫거나 숨길 때는 즉시 기록한다
  const latest = useRef({ s, sel, prefs })
  latest.current = { s, sel, prefs }
  useEffect(() => {
    const flush = () => saveState({ settings: latest.current.s, selection: latest.current.sel }, latest.current.prefs)
    const t = window.setTimeout(flush, 400)
    return () => window.clearTimeout(t)
  }, [s, sel, prefs])
  useEffect(() => {
    const flush = () => saveState({ settings: latest.current.s, selection: latest.current.sel }, latest.current.prefs)
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  useEffect(() => {
    if (initial.missing) push(`저장된 아이콘 “${initial.missing}”이(가) 라이브러리에 없어 기본 아이콘(${kebab(DEFAULT_SETTINGS.icon)})으로 되돌렸습니다.`, 'info')
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus()
  }, [initial.missing, push])

  // `/` 로 검색에 포커스
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v })), [])
  const pick = useCallback((key: string, track: boolean) => {
    setS((p) => (p.icon === key ? p : { ...p, icon: key }))
    if (track) setPrefs((p) => ({ ...p, recentIcons: pushRecent(p.recentIcons, key, MAX_RECENT_ICONS) }))
    else setRevealTick((t) => t + 1)
  }, [])
  const toggleFav = useCallback((key: string) => setPrefs((p) => ({ ...p, favorites: toggleIn(p.favorites, key) })), [])
  const commitColor = useCallback((c: string) => setPrefs((p) => ({ ...p, recentColors: pushRecent(p.recentColors, c.toLowerCase(), MAX_RECENT_COLORS) })), [])
  const setBackdrop = useCallback((b: Backdrop) => setPrefs((p) => ({ ...p, backdrop: b })), [])
  const setGuide = useCallback((v: boolean) => setPrefs((p) => ({ ...p, maskGuide: v })), [])
  const onCopied = useCallback((ok: boolean, what: string) => push(ok ? `${what}를 복사했습니다.` : '복사하지 못했습니다. 브라우저가 클립보드 접근을 막았습니다.', ok ? 'ok' : 'error'), [push])

  const rk = renderKey(s)
  const rs = useMemo(() => ({ ...s, customSizes: NO_SIZES }), [rk]) // eslint-disable-line react-hooks/exhaustive-deps
  const node = getIconNode(s.icon)
  const anySelected = Object.values(sel).some(Boolean)
  const hasBg = s.bgShape !== 'none'
  const { ignored } = useMemo(() => parseSizesDetailed(sizesText), [sizesText])
  const customEmpty = sel.custom && s.customSizes.length === 0
  const stroke16 = effectiveStroke(s.strokeWidth, 16, s.autoStroke, hasBg ? 100 - s.padding * 2 : 100 - Math.min(s.padding, 40) * 2)

  async function onDownload() {
    if (!node || !anySelected || customEmpty || busy) return
    setBusy(true)
    setProgress(null)
    setShowProgress(false)
    // 진행 표시는 150ms 를 넘길 때만 띄운다
    const timer = window.setTimeout(() => setShowProgress(true), 150)
    try {
      const zip = await buildZip(node, s, sel, rasterize, setProgress)
      download(zip as BlobPart, `icons-${s.icon.toLowerCase()}.zip`, 'application/zip')
      push('zip 을 만들었습니다.')
    } catch (e) {
      push(`생성에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      window.clearTimeout(timer)
      setBusy(false)
      setShowProgress(false)
      setProgress(null)
    }
  }

  const importText = useCallback((text: string) => {
    const parsed = parseSettingsJson(text)
    if (!parsed) return push('icon-forge 설정 파일이 아닙니다.', 'error')
    const fixed = fixIcon(parsed.settings, DEFAULT_SETTINGS.icon)
    setS(fixed.settings)
    setSel(parsed.selection)
    setSizesText(fixed.settings.customSizes.join(', '))
    setRevealTick((t) => t + 1)
    if (fixed.missing) push(`설정을 불러왔지만 아이콘 “${fixed.missing}”이(가) 없어 기본 아이콘으로 되돌렸습니다.`, 'info')
    else push('설정을 불러왔습니다.')
  }, [push])

  const importFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (file.size > 1_000_000) return push('설정 파일이 너무 큽니다(1MB 초과).', 'error')
    try {
      importText(await file.text())
    } catch {
      push('파일을 읽지 못했습니다.', 'error')
    }
  }, [importText, push])

  // 창 어디에 놓아도 설정 JSON 을 불러온다. 창 밖 동작으로 페이지가 바뀌지 않게 막는다
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true) }
    const over = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy' }
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false) }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) void importFile(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [importFile])

  function reset() {
    setS(DEFAULT_SETTINGS)
    setSel(DEFAULT_SELECTION)
    setSizesText(DEFAULT_SETTINGS.customSizes.join(', '))
    setRevealTick((t) => t + 1)
    push('설정을 초기화했습니다.', 'info')
  }

  const svgText = () => buildIconSvg(node!, s) + '\n'
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="app" data-dragover={dragging ? '' : undefined}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Ico n="mark" className="" /></span>
          <h1>Icon Forge</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} title="설정 JSON 불러오기 (파일을 끌어다 놓아도 됩니다)">
            <Ico n="upload" /><span className="btn-text">설정 불러오기</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { download(settingsToJson(s, sel), 'icon-forge.json', 'application/json'); push('설정을 저장했습니다.') }} title="설정 JSON 내보내기">
            <Ico n="save" /><span className="btn-text">설정 내보내기</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} title="설정 초기화">
            <Ico n="reset" /><span className="btn-text">초기화</span>
          </button>
          <button type="button" id="themeToggle" className="icon-btn" onClick={toggle} aria-label="테마 변경" title={theme === 'dark' ? '라이트 테마로' : '다크 테마로'}>
            <Ico n="sun" className="icon icon-sun" />
            <Ico n="moon" className="icon icon-moon" />
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </header>

      <main className="layout">
        <IconPicker
          selected={s.icon}
          favorites={prefs.favorites}
          recent={prefs.recentIcons}
          revealTick={revealTick}
          searchRef={searchRef}
          onPick={pick}
          onToggleFav={toggleFav}
        />

        <div className="col-right">
          <section className="card settings" aria-label="모양과 출력">
            <div className="card-body">
              <h2>모양</h2>
              <div className="form">
                <ColorField label="선 색" value={s.strokeColor} onChange={(v) => set('strokeColor', v)} recent={prefs.recentColors} onCommit={commitColor} />
                <Range label="선 굵기" value={s.strokeWidth} min={0.5} max={3.5} step={0.25} onChange={(v) => set('strokeWidth', v)} />
                <Switch checked={s.autoStroke} onChange={(v) => set('autoStroke', v)} hint={`16px 에서 ${Math.round(stroke16 * 100) / 100}`}>
                  크기별 선 굵기 자동 보정
                </Switch>

                <div className="field">
                  <span className="field-top"><span>배경</span></span>
                  <Segmented<Settings['bgShape']>
                    label="배경 모양"
                    value={s.bgShape}
                    onChange={(v) => set('bgShape', v)}
                    options={[{ value: 'none', label: '없음(투명)' }, { value: 'square', label: '사각형' }, { value: 'circle', label: '원' }]}
                  />
                </div>
                {hasBg && (
                  <>
                    <ColorField label="배경 색" value={s.bgColor} onChange={(v) => set('bgColor', v)} recent={prefs.recentColors} onCommit={commitColor} />
                    <Switch checked={s.bgGradient} onChange={(v) => set('bgGradient', v)}>그라데이션</Switch>
                    {s.bgGradient && <ColorField label="그라데이션 끝 색" value={s.bgColor2} onChange={(v) => set('bgColor2', v)} recent={prefs.recentColors} onCommit={commitColor} />}
                    {s.bgShape === 'square' && <Range label="모서리 둥글기" value={s.bgRadius} min={0} max={50} unit="%" onChange={(v) => set('bgRadius', v)} />}
                  </>
                )}
                <Range label="여백" value={s.padding} min={0} max={40} unit="%" onChange={(v) => set('padding', v)} />
                <Switch checked={s.shadow} onChange={(v) => set('shadow', v)}>그림자</Switch>
                <Switch checked={s.softenSmall} onChange={(v) => set('softenSmall', v)}>32px 이하에서 그림자 끄기·그라데이션 약화</Switch>
              </div>

              <h2>출력</h2>
              <ul className="presets">
                {PRESET_INFO.map((p) => (
                  <li key={p.id} className={sel[p.id as PresetId] ? 'on' : ''}>
                    <Switch checked={sel[p.id as PresetId]} onChange={(v) => setSel((x) => ({ ...x, [p.id]: v }))} hint={p.desc}>
                      {p.label}
                    </Switch>
                    {p.id === 'custom' && sel.custom && (
                      <div className="custom-sizes">
                        <input
                          className="text-input mono"
                          aria-label="직접 지정 크기"
                          aria-invalid={customEmpty || ignored.length > 0}
                          value={sizesText}
                          placeholder="예: 24, 64, 256 (1~1024)"
                          onChange={(e) => {
                            setSizesText(e.target.value)
                            set('customSizes', parseSizesDetailed(e.target.value).sizes)
                          }}
                        />
                        {ignored.length > 0 && (
                          <p className="warn-text" role="status">
                            무시한 값: {ignored.map((t) => (t.length > 12 ? `${t.slice(0, 12)}…` : t)).join(', ')} (1~1024 의 정수만 쓸 수 있습니다)
                          </p>
                        )}
                        {customEmpty && <p className="warn-text">올바른 숫자를 하나 이상 입력해 주세요.</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-foot">
              <button type="button" className="btn btn-primary dl-btn" disabled={!node || !anySelected || customEmpty} aria-busy={busy} onClick={onDownload}>
                <Ico n="download" />
                <span>{busy && showProgress && progress ? `만드는 중 ${progress.done}/${progress.total}` : busy && showProgress ? '만드는 중…' : 'zip 다운로드'}</span>
              </button>
              <div className={`dl-progress${busy && showProgress ? ' active' : ''}`} aria-hidden={!(busy && showProgress)}>
                <div className="dl-track" role="progressbar" aria-label="zip 생성 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="dl-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="dl-file">{progress?.path ?? ''}</span>
              </div>
            </div>
          </section>

          <section className="card side" aria-label="미리보기와 코드">
            <div className="card-body">
              <div className="side-head">
                <h2>미리보기</h2>
                <div className="side-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!node}
                    onClick={async () => onCopied(await copyText(svgText()), 'SVG')}
                    title="현재 설정이 반영된 SVG 를 클립보드에 복사"
                  >
                    <Ico n="copy" /><span>SVG 복사</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!node}
                    onClick={() => { download(svgText(), `icon-${s.icon.toLowerCase()}.svg`, 'image/svg+xml'); push('SVG 를 저장했습니다.') }}
                    title="SVG 파일로 저장"
                  >
                    <Ico n="file" /><span>SVG 저장</span>
                  </button>
                </div>
              </div>
              <PreviewPanel rs={rs} backdrop={prefs.backdrop} guide={prefs.maskGuide} onBackdrop={setBackdrop} onGuide={setGuide} />
              <Snippets sel={sel} onCopied={onCopied} />
            </div>
          </section>
        </div>
      </main>

      <div className="drop-hint" aria-hidden="true">설정 JSON 을 놓아 불러오기</div>
      <Toasts toasts={toasts} />
    </div>
  )
}
