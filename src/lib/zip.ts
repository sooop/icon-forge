import { zipSync, type Zippable } from 'fflate'
import lucideLicense from 'lucide/LICENSE?raw'
import { asBytes, buildPresetFiles, presetFileCount, selectedPresets, type Rasterize } from './presets'
import { settingsToJson } from './storage'
import { buildSvg, type IconNode } from './svg'
import type { Selection, Settings } from './types'

export interface ZipProgress {
  done: number
  total: number
  path: string
}

/** icon.svg 의 기준 크기. 벡터라 크기는 의미가 없고, 큰 쪽 기준(선 굵기 보정 없음)으로 만든다 */
export const SVG_EXPORT_SIZE = 512

export function buildIconSvg(node: IconNode, s: Settings): string {
  return buildSvg(node, s, SVG_EXPORT_SIZE, 'normal')
}

/** zip 안의 파일 수(진행률 분모): 프리셋 파일 + icon.svg + 설정 JSON + 라이선스 */
export function zipFileCount(sel: Selection, s: Settings): number {
  return selectedPresets(sel).reduce((n, id) => n + presetFileCount(id, s), 0) + 3
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

export async function buildZip(
  node: IconNode,
  s: Settings,
  sel: Selection,
  rasterize: Rasterize,
  onProgress?: (p: ZipProgress) => void,
): Promise<Uint8Array> {
  const entries: Zippable = {}
  const total = zipFileCount(sel, s)
  let done = 0
  // 파일 하나가 끝날 때마다 진행을 알리고 메인 스레드를 한 번 양보해 화면이 갱신되게 한다
  const step = async (path: string) => {
    done++
    onProgress?.({ done, total, path })
    await tick()
  }
  const put = (path: string, data: Uint8Array) => {
    // PNG 는 이미 압축돼 있어 저장만 하고, 텍스트만 deflate 한다
    entries[path] = [data, { level: path.endsWith('.png') || path.endsWith('.ico') ? 0 : 6 }]
  }
  for (const id of selectedPresets(sel)) {
    for (const f of await buildPresetFiles(id, node, s, rasterize, step)) put(f.path, asBytes(f.data))
  }
  put('icon.svg', asBytes(buildIconSvg(node, s) + '\n'))
  await step('icon.svg')
  put('icon-forge.json', asBytes(settingsToJson(s, sel)))
  await step('icon-forge.json')
  put('LICENSE-lucide.txt', asBytes(lucideLicense))
  await step('LICENSE-lucide.txt')
  return zipSync(entries)
}
