import { zipSync } from 'fflate'
import lucideLicense from 'lucide/LICENSE?raw'
import { asBytes, buildPresetFiles, selectedPresets, type Rasterize } from './presets'
import { settingsToJson } from './storage'
import type { IconNode } from './svg'
import type { Selection, Settings } from './types'

export async function buildZip(node: IconNode, s: Settings, sel: Selection, rasterize: Rasterize): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {}
  for (const id of selectedPresets(sel)) {
    for (const f of await buildPresetFiles(id, node, s, rasterize)) entries[f.path] = asBytes(f.data)
  }
  entries['icon-forge.json'] = asBytes(settingsToJson(s, sel))
  entries['LICENSE-lucide.txt'] = asBytes(lucideLicense)
  return zipSync(entries, { level: 6 })
}
