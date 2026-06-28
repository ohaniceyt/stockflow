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

function extractEagerImageSrces(markup: string): string[] {
  const srces: string[] = []
  const regex = /<img[^>]*\sloading="eager"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(markup)) !== null) {
    const srcMatch = /src="([^"]+)"/.exec(match[0])
    if (srcMatch && srcMatch[1]) srces.push(srcMatch[1])
  }
  return srces
}

function buildPreloadLinks(markup: string): string {
  const images = new Set<string>()
  // Logo is always above the fold in the marketing header.
  images.add('/logo.svg')
  // Preload any explicitly eager-above-the-fold images (e.g. hero screenshot).
  for (const src of extractEagerImageSrces(markup)) {
    images.add(src)
  }
  return Array.from(images)
    .map(
      (src) =>
        `  <link rel="preload" as="image" href="${src}" fetchpriority="high">`,
    )
    .join('\n')
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

  const outPath =
    route === '/'
      ? indexPath
      : path.join(distDir, `${route}.html`)

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, page)
}

console.log(`Prerendered ${routes.length.toString()} marketing pages into ${distDir}`)
