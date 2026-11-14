import { useEffect, useRef, useState, type ReactNode } from 'react'
import { copyText } from '../lib/util'
import { Ico } from './Ico'

export function Switch({ checked, onChange, children, hint }: {
  checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: ReactNode
}) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
      <span className="switch-label">
        {children}
        {hint && <small className="switch-hint">{hint}</small>}
      </span>
    </label>
  )
}

export function Range({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void
}) {
  return (
    <label className="field">
      <span className="field-top">
        <span>{label}</span>
        <output>{value}{unit}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="segmented" role="group" aria-label={label} style={{ '--n': options.length, '--i': i } as React.CSSProperties}>
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 색 입력 + 최근 쓴 색 스와치. 입력이 700ms 멈추면 그 색을 최근 목록에 올린다 */
export function ColorField({ label, value, onChange, recent, onCommit }: {
  label: string; value: string; onChange: (v: string) => void; recent: string[]; onCommit: (v: string) => void
}) {
  const timer = useRef<number>(0)
  const latest = useRef(onCommit)
  latest.current = onCommit
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const edit = (v: string) => {
    onChange(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => latest.current(v), 700)
  }
  return (
    <div className="field color-field">
      <span className="field-top"><span>{label}</span><output className="mono">{value}</output></span>
      <div className="color-row">
        <input type="color" aria-label={label} value={value} onChange={(e) => edit(e.target.value)} />
        {recent.length > 0 && (
          <div className="swatches" role="group" aria-label={`${label} 최근 색`}>
            {recent.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch"
                style={{ background: c }}
                aria-label={`최근 색 ${c} 적용`}
                aria-pressed={c === value.toLowerCase()}
                title={c}
                onClick={() => { onChange(c); window.clearTimeout(timer.current); latest.current(c) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CopyButton({ getText, label, onResult, className = 'btn btn-sm' }: {
  getText: () => string; label: string; onResult: (ok: boolean) => void; className?: string
}) {
  const [copied, setCopied] = useState(false)
  const t = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(t.current), [])
  return (
    <button
      type="button"
      className={`${className} copy-btn${copied ? ' copied' : ''}`}
      onClick={async () => {
        const ok = await copyText(getText())
        onResult(ok)
        if (ok) {
          setCopied(true)
          window.clearTimeout(t.current)
          t.current = window.setTimeout(() => setCopied(false), 1400)
        }
      }}
    >
      <span className="copy-icons" aria-hidden="true">
        <Ico n="copy" className="icon icon-copy" />
        <Ico n="check" className="icon icon-done" />
      </span>
      <span>{label}</span>
    </button>
  )
}
