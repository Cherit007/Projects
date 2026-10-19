import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '../dist')
const index = resolve(dist, 'index.html')
const fallback = resolve(dist, '404.html')

if (!existsSync(index)) {
  console.error('dist/index.html missing — run build first')
  process.exit(1)
}

copyFileSync(index, fallback)
console.log('Wrote dist/404.html for GitHub Pages SPA routes')
