// Rasterizes the SVG logo into the PNG icons the PWA + iOS home screen need.
// Run with: npm run icons   (after editing public/icons/favicon.svg)
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'public', 'icons', 'favicon.svg')
const out = join(root, 'public', 'icons')

const svg = await readFile(src)
const targets = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  // iOS home-screen icon: opaque background, no transparency, 180px.
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size)
    .flatten({ background: '#0f172a' })
    .png()
    .toFile(join(out, t.name))
  console.log('wrote', t.name)
}
