import { useMemo, useState } from 'react'
import { SNIPPETS } from '../lib/presets'
import type { PresetId, Selection } from '../lib/types'
import { CopyButton, Segmented } from './Controls'

export function Snippets({ sel, onCopied }: { sel: Selection; onCopied: (ok: boolean, what: string) => void }) {
  const avail = useMemo(() => SNIPPETS.filter((s) => sel[s.id]), [sel])
  const [tab, setTab] = useState<PresetId>('extension')
  if (avail.length === 0) return null
  const cur = avail.find((s) => s.id === tab) ?? avail[0]
  const code = cur.make()
  return (
    <section className="snippets" aria-label="붙여넣을 코드 조각">
      <div className="snippets-head">
        <h2>코드 조각</h2>
        <span className="snippets-target">{cur.target}</span>
      </div>
      {avail.length > 1 && (
        <Segmented<PresetId> label="코드 조각 종류" value={cur.id} onChange={setTab} options={avail.map((s) => ({ value: s.id, label: s.label }))} />
      )}
      <div className="code-block">
        <pre className="code" tabIndex={0} aria-label={`${cur.label} 코드`}><code>{code}</code></pre>
        <CopyButton className="btn btn-sm code-copy" label="복사" getText={() => code} onResult={(ok) => onCopied(ok, `${cur.label} 코드`)} />
      </div>
    </section>
  )
}
