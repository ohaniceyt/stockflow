import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderToString } from 'react-dom/server'
import { LandingApp } from '../src/features/marketing/PrerenderApp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const template = fs.readFileSync(indexPath, 'utf8')

const routes = [
  '/',
  '/pricing',
  '/features/inventory',
  '/features/pos-cashier',
  '/features/invoicing',
  '/features/offline',
  '/features/analytics',
]

const demoScript = `<script type="module">
  const open = document.getElementById('demo-open');
  const close = document.getElementById('demo-close');
  const dialog = document.getElementById('demo-dialog');
  if (open && dialog) open.addEventListener('click', () => dialog.showModal());
  if (close && dialog) close.addEventListener('click', () => dialog.close());
</script>
`

interface ResponsiveImagePreload {
  srcset: string
  sizes: string
}

function extractEagerResponsivePreloads(markup: string): ResponsiveImagePreload[] {
  const preloads: ResponsiveImagePreload[] = []
  const pictureRegex = /<picture[^>]*>[\s\S]*?<\/picture>/g
  let match: RegExpExecArray | null
  while ((match = pictureRegex.exec(markup)) !== null) {
    const picture = match[0]
    if (!picture.includes('loading="eager"')) continue
    const sourceMatch = /<source[^>]*type="image\/webp"[^>]*>/.exec(picture)
    if (!sourceMatch) continue
    const srcsetMatch = /src[Ss]et="([^"]+)"/.exec(sourceMatch[0])
    const sizesMatch = /sizes="([^"]+)"/.exec(sourceMatch[0])
    if (srcsetMatch) {
      preloads.push({
        srcset: srcsetMatch[1],
        sizes: sizesMatch?.[1] ?? '100vw',
      })
    }
  }
  return preloads
}

function buildPreloadLinks(markup: string): string {
  const lines: string[] = []
  // Logo is always above the fold in the marketing header.
  lines.push('  <link rel="preload" as="image" href="/logo.svg">')

  // Preload responsive WebP variants for any above-the-fold picture
  // (e.g. the hero screenshot). Browsers pick the right srcset candidate.
  for (const { srcset, sizes } of extractEagerResponsivePreloads(markup)) {
    lines.push(
      `  <link rel="preload" as="image" type="image/webp" imagesrcset="${srcset}" imagesizes="${sizes}" fetchpriority="high">`
    )
  }

  return lines.join('\n')
}

for (const route of routes) {
  let markup = renderToString(<LandingApp initialPath={route} />)

  // Remove any preloads the React runtime injected into the body; we want
  // them in <head> where the parser discovers them early.
  markup = markup.replace(/<link rel="preload"[^>]*>/g, '')

  const preloadLinks = buildPreloadLinks(markup)

  const page = template
    .replace(new RegExp('<script type="module"[^>]*><\\/script>', 'g'), '')
    .replace(new RegExp('<div id="root"><\\/div>'), `<div id="root">${markup}</div>`)
    .replace(new RegExp('<\\/body>'), `${demoScript}</body>`)
    .replace(new RegExp('<\\/head>'), `${preloadLinks}\n</head>`)

  const outPath = route === '/' ? indexPath : path.join(distDir, `${route}.html`)

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, page)
}

console.log(`Prerendered ${routes.length.toString()} marketing pages into ${distDir}`)
