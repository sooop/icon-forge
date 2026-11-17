// skill/icon-forge 폴더를 claude.ai 업로드용 zip(루트에 icon-forge/ 폴더)으로 묶는다.
import { zipSync } from 'fflate'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'skill'
const entries = {}
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else entries[relative(root, p).replaceAll('\\', '/')] = readFileSync(p)
  }
}
walk(join(root, 'icon-forge'))
mkdirSync('dist-cli', { recursive: true })
writeFileSync('dist-cli/icon-forge-skill.zip', zipSync(entries, { level: 9 }))
console.log('packed dist-cli/icon-forge-skill.zip:', Object.keys(entries).join(', '))
