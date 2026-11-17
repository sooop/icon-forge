// CLI 를 단일 .mjs 로 묶는다(lucide 아이콘 데이터·resvg wasm·라이선스 포함 → 설치·네트워크 불필요).
// 결과물은 스킬 폴더(skill/icon-forge/scripts)와 dist-cli 에 둔다.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'

const outfile = 'skill/icon-forge/scripts/icon-forge.mjs'
mkdirSync('skill/icon-forge/scripts', { recursive: true })
await build({
  entryPoints: ['cli/icon-forge.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  minify: true,
  loader: { '.wasm': 'binary' },
  // LICENSE 는 확장자가 없어 text 로더를 지정한다
  plugins: [
    {
      name: 'license-text',
      setup(b) {
        b.onLoad({ filter: /lucide[\\/]LICENSE$/ }, async (a) => {
          const { readFile } = await import('node:fs/promises')
          return { contents: await readFile(a.path, 'utf8'), loader: 'text' }
        })
      },
    },
  ],
  banner: { js: '#!/usr/bin/env node' },
})
mkdirSync('dist-cli', { recursive: true })
copyFileSync(outfile, 'dist-cli/icon-forge.mjs')
console.log('built', outfile)
