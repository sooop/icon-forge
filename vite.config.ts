/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** vite-plugin-singlefile 이 <link rel="icon"> 은 인라인하지 않으므로 favicon·apple-touch-icon(PNG, iOS Safari 는 SVG 를 못 읽음)을 data URI 로 바꿔 넣는다. */
const inlineFavicon = (): Plugin => ({
  name: 'inline-favicon',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replace(/(<link rel="(?:icon|apple-touch-icon)"[^>]*?href=")(\/src\/[^"]+\.png)(")/g, (_m, a: string, p: string, c: string) =>
        `${a}data:image/png;base64,${readFileSync(fileURLToPath(new URL('.' + p, import.meta.url))).toString('base64')}${c}`),
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), inlineFavicon(), viteSingleFile()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
